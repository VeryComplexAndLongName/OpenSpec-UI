import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
