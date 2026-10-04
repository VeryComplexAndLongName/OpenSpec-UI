import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentStatusReport } from "./agent-status.js";
import type { LastRunsReport } from "./last-runs-facts.js";
import { readPipelineReadiness } from "./pipeline-readings.js";

// every-varying-check-has-a-budget: a temporary directory that is not a
// git repository, so the readiness report has no change to diff and no
// git process of any length is started.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function workspace(harnessConfig?: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-pipeline-readings-"));
  temporaryRoots.push(root);
  await mkdir(path.join(root, "openspec", "changes"), { recursive: true });
  if (harnessConfig !== undefined) {
    await writeFile(path.join(root, "openspec", "agent-harness.json"), harnessConfig, "utf8");
  }
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("readPipelineReadiness — the one readiness payload", () => {
  it("carries suggestions where the configuration says nothing about them", async () => {
    const report = await readPipelineReadiness(await workspace());

    expect(Array.isArray(report.changes)).toBe(true);
    expect(Array.isArray(report.hints)).toBe(true);
  });

  it("carries no hints key at all where the configuration turns them off", async () => {
    const report = await readPipelineReadiness(await workspace(JSON.stringify({ hints: { enabled: false } })));

    // Absent, not empty: an empty list would say they were computed and
    // found nothing, which is a different statement about the workspace.
    expect("hints" in report).toBe(false);
  });

  it("carries no hints key where the configuration cannot be read, and still answers", async () => {
    const report = await readPipelineReadiness(await workspace("{ not json"));

    expect(Array.isArray(report.changes)).toBe(true);
    expect("hints" in report).toBe(false);
  });
});

// the-supervisor-advises 3.3: the supervisor's suggestions ride the same
// payload, under the workspace's switch and a change's own.
describe("readPipelineReadiness — the supervisor's suggestions", () => {
  const silent: AgentStatusReport = {
    instanceId: "i1",
    activity: "running npm test",
    stage: "apply",
    changeName: "demo",
    workingDirectory: "/work/demo",
    activitySinceMs: 20 * 60_000,
    heartbeatAgeMs: 2_000,
    activityAt: "2026-10-04T10:00:00.000Z",
    heartbeatAt: "2026-10-04T10:20:00.000Z",
    gone: false,
    runId: "r1",
    task: null,
    waiting: null,
    stopRequested: null,
    signature: "unverified",
    machine: "box",
    gitAuthor: null,
  };
  const signedOut: LastRunsReport = {
    byChange: {
      other: {
        runId: "c1",
        outcome: "failed",
        endedAt: "2026-10-04T09:00:00.000Z",
        diagnosis: { cause: "not-signed-in", repeatHelps: "no" },
      },
    },
  };

  it("are carried by default, after the others", async () => {
    const report = await readPipelineReadiness(await workspace(), { statuses: [silent], lastRuns: signedOut });

    expect(report.hints?.map((hint) => hint.kind)).toEqual(["run-says-nothing-new", "last-run-cannot-be-repeated"]);
  });

  it("are not computed where the workspace turns the supervisor off, and the rest still are", async () => {
    const report = await readPipelineReadiness(
      await workspace(JSON.stringify({ supervisor: { mode: "off" } })),
      { statuses: [silent], lastRuns: signedOut },
    );

    expect(report.hints).toEqual([]);
  });

  it("follow a change that turns it off for itself", async () => {
    const root = await workspace();
    await mkdir(path.join(root, "openspec", "changes", "demo"), { recursive: true });
    await writeFile(path.join(root, "openspec", "changes", "demo", "harness.json"), JSON.stringify({ supervisor: { mode: "off" } }), "utf8");

    const report = await readPipelineReadiness(root, { statuses: [silent], lastRuns: signedOut });

    // The change's directory is a change of its own, so the readiness
    // report has its own suggestion about it; only the supervisor's are
    // asked about here.
    const supervisors = new Set(["run-says-nothing-new", "run-waits-on-you", "last-run-cannot-be-repeated"]);
    expect(report.hints?.filter((hint) => supervisors.has(hint.kind)).map((hint) => hint.kind))
      .toEqual(["last-run-cannot-be-repeated"]);
  });

  it("are not computed where suggestions are off altogether", async () => {
    const report = await readPipelineReadiness(
      await workspace(JSON.stringify({ hints: { enabled: false } })),
      { statuses: [silent], lastRuns: signedOut },
    );

    expect("hints" in report).toBe(false);
  });
});
