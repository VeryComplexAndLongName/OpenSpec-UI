import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { announceAgent } from "./agent-presence.js";
import { readAgentStatuses } from "./agent-status.js";

// Measured 2026-09-20: four writes into a temporary directory, under
// 2s for the file. The ceiling is generous because the writer reads
// the git author of a real directory.
vi.setConfig({ testTimeout: 15_000 });

// an-agent-says-where-it-is-working 2.3: the record a session writes is
// the record a run writes, so every reader shows it already.

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A real directory to stand in, and a status directory beside it.
 *
 * Real because the writer reads the git author of its working directory,
 * and `simple-git` throws synchronously on a path that does not exist -
 * which the factory catches, returning no writer at all. A fake path
 * therefore tests the failure rather than the feature. */
async function workspace(): Promise<{ cwd: string; directory: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-presence-"));
  roots.push(root);
  return { cwd: root, directory: path.join(root, ".agent-status") };
}

describe("announceAgent", () => {
  it("writes a record a reader of runs finds, with the change and what it is doing", async () => {
    const { cwd, directory } = await workspace();

    const presence = await announceAgent({
      cwd,
      changeName: "demo",
      activity: "writing the proposal",
      resolveDirectory: async () => directory,
      loadKey: async () => undefined,
    });

    expect(presence).toBeDefined();
    const { reports } = await readAgentStatuses(directory);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      changeName: "demo",
      activity: "writing the proposal",
      // No run id: this is an agent at a desk, not a run.
      runId: null,
      gone: false,
    });
    await presence?.end();
  });

  it("says what it is doing now, and leaves nothing behind when it ends", async () => {
    const { cwd, directory } = await workspace();
    const presence = await announceAgent({
      cwd,
      activity: "reading",
      resolveDirectory: async () => directory,
      loadKey: async () => undefined,
    });

    await presence?.report("running the core suite");
    expect((await readAgentStatuses(directory)).reports[0]?.activity).toBe("running the core suite");

    await presence?.end();
    expect((await readAgentStatuses(directory)).reports).toEqual([]);
  });

  it("lets two agents each read the other", async () => {
    const { cwd, directory } = await workspace();
    const mine = await announceAgent({
      cwd,
      changeName: "budget",
      activity: "writing core",
      resolveDirectory: async () => directory,
      loadKey: async () => undefined,
    });
    const theirs = await announceAgent({
      cwd,
      changeName: "tour",
      activity: "recording the tour",
      resolveDirectory: async () => directory,
      loadKey: async () => undefined,
    });

    const { reports } = await readAgentStatuses(directory);

    expect(reports.map((report) => report.changeName).sort()).toEqual(["budget", "tour"]);
    expect(new Set(reports.map((report) => report.instanceId)).size).toBe(2);
    await mine?.end();
    await theirs?.end();
  });

  it("answers undefined rather than refusing to work where no record can be written", async () => {
    const { cwd } = await workspace();
    const presence = await announceAgent({
      cwd,
      activity: "writing",
      resolveDirectory: async () => { throw new Error("not a git repository"); },
      loadKey: async () => undefined,
    });

    expect(presence).toBeUndefined();
  });
});
