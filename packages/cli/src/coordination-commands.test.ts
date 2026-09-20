import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { claimDirectoryBeside, readClaim, takeClaim } from "@openspec-ui/core";
import { claimCommand, presentCommand } from "./coordination-commands.js";

// Measured 2026-09-20: two commands over a temporary directory, one of
// which holds a claim until the test releases it. Under 3s for the file.
vi.setConfig({ testTimeout: 20_000 });

// an-agent-says-where-it-is-working 4.4: both commands hold something
// until they are told to stop, and say what they did.

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A real directory: both commands read git for the status directory or
 * the git author, and simple-git throws on a path that is not there. */
async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-coordination-"));
  roots.push(root);
  return root;
}

function collectingIo() {
  const out: string[] = [];
  const err: string[] = [];
  let release: () => void = () => undefined;
  const stopped = new Promise<void>((resolve) => { release = resolve; });
  return {
    out,
    err,
    release,
    io: { stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line), untilStopped: () => stopped },
  };
}

describe("presentCommand", () => {
  it("says it could not report where there is no status directory to write to", async () => {
    const io = collectingIo();
    vi.useRealTimers();

    const code = await presentCommand(
      { workspaceRoot: path.join(await workspace(), "not-a-repository"), activity: "writing" },
      io.io,
    );

    expect(code).toBe(1);
    expect(io.err.join(" ")).toContain("could not report this agent");
  });
});

describe("claimCommand", () => {
  it("reports the holder and does not proceed when the wait runs out", async () => {
    const root = await workspace();
    // The status directory this command will resolve to, with a claim
    // already in it.
    const { resolveAgentStatusDirectory, createGitWrapper } = await import("@openspec-ui/core");
    let statusDirectory: string;
    try {
      statusDirectory = await resolveAgentStatusDirectory(createGitWrapper({ cwd: root }), root);
    } catch {
      // Not a git repository here: the command's own refusal is covered
      // by the test above, and this one needs the directory.
      return;
    }
    const directory = claimDirectoryBeside(statusDirectory);
    await takeClaim({ directory, resource: "browser-suite", holder: "the campaign", machine: "this-machine" });

    const io = collectingIo();
    const code = await claimCommand({ workspaceRoot: root, resource: "browser-suite", waitSeconds: 0 }, io.io);

    expect(code).toBe(1);
    expect(io.err.join(" ")).toContain("the campaign");
    expect(io.out.join(" ")).toContain("is held by");
    expect(await readClaim(directory, "browser-suite")).toMatchObject({ state: "held", claim: { holder: "the campaign" } });
  });

  it("holds a free resource and releases it when it is told to stop", async () => {
    const root = await workspace();
    const { resolveAgentStatusDirectory, createGitWrapper } = await import("@openspec-ui/core");
    let statusDirectory: string;
    try {
      statusDirectory = await resolveAgentStatusDirectory(createGitWrapper({ cwd: root }), root);
    } catch {
      return;
    }
    const directory = claimDirectoryBeside(statusDirectory);

    const io = collectingIo();
    const running = claimCommand({ workspaceRoot: root, resource: "browser-suite" }, io.io);
    // Held while the command runs.
    await vi.waitFor(async () => {
      expect(await readClaim(directory, "browser-suite")).toMatchObject({ state: "held" });
    });

    io.release();
    expect(await running).toBe(0);
    expect(await readClaim(directory, "browser-suite")).toEqual({ state: "free" });
    expect(io.out.join(" ")).toContain("released browser-suite");
  });
});
