import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runChainStep, isWaitingStep, CHAIN_STEP_NAMES } from "./chain-steps.js";

// every-varying-check-has-a-budget: every wait here is driven at a 20ms
// poll interval against a local directory, so the slowest test is bounded
// by its own declared maximum (200ms) rather than by the registry's real
// five-second interval. Measured 2026-09-11 under 400ms for the file.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-chain-steps-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeChange(root: string, changeName: string): Promise<string> {
  const changeDir = path.join(root, "openspec", "changes", changeName);
  await mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, "proposal.md"), "# A change\n\n## Why\n\nBecause.\n", "utf8");
  await writeFile(path.join(changeDir, "tasks.md"), "- [ ] 1.1 Do the thing\n", "utf8");
  return changeDir;
}

/** Lands a change the way archiving does: out of the active directory
 * and into the archive. What `await-change` watches for is exactly this
 * — the change no longer being active. */
async function land(root: string, changeName: string): Promise<void> {
  const archive = path.join(root, "openspec", "changes", "archive");
  await mkdir(archive, { recursive: true });
  await rename(
    path.join(root, "openspec", "changes", changeName),
    path.join(archive, `2026-09-11-${changeName}`),
  );
}

function ctx(root: string, overrides: Partial<Parameters<typeof runChainStep>[2]> = {}) {
  return {
    workspaceRoot: root,
    changeName: "mine",
    maxWaitMs: 2_000,
    pollIntervalMs: 20,
    ...overrides,
  };
}

describe("the chain-step registry", () => {
  it("is closed, and every name in it has an entry", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "theirs");
    await land(root, "theirs");

    // A name the registry lists but cannot run would pass configuration
    // validation and fail mid-chain.
    for (const name of CHAIN_STEP_NAMES) {
      await expect(runChainStep(name, "theirs", ctx(root))).resolves.toBeDefined();
    }
  });
});

describe("await-change", () => {
  it("finishes at once when the change has already landed", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "mine");
    await makeChange(root, "theirs");
    await land(root, "theirs");

    const startedAt = Date.now();
    const result = await runChainStep("await-change", "theirs", ctx(root, { pollIntervalMs: 1_000 }));

    expect(result.ok).toBe(true);
    expect(result.reason).toContain("had already landed");
    // Asked before waiting begins, so a settled question costs no
    // interval — with a one-second interval this would otherwise take one.
    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  it("waits, and continues once the change lands", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "mine");
    await makeChange(root, "theirs");

    const wait = runChainStep("await-change", "theirs", ctx(root));
    setTimeout(() => void land(root, "theirs"), 60);
    const result = await wait;

    expect(result.ok).toBe(true);
    expect(result.reason).toContain('"theirs" landed');
  });

  it("fails naming the change and the duration when the wait runs out", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "mine");
    await makeChange(root, "theirs");

    const result = await runChainStep("await-change", "theirs", ctx(root, { maxWaitMs: 200 }));

    expect(result.ok).toBe(false);
    // Not a bare timeout: the reader has to know what was waited for
    // before they can decide whether waiting longer would help.
    expect(result.reason).toContain("theirs");
    expect(result.reason).toMatch(/waited \d+s/);
  });

  it("stops waiting when the chain is cancelled", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "mine");
    await makeChange(root, "theirs");
    const controller = new AbortController();

    const wait = runChainStep("await-change", "theirs", ctx(root, { maxWaitMs: 10_000, signal: controller.signal }));
    setTimeout(() => controller.abort(), 40);
    const result = await wait;

    // An interrupted run must stop waiting rather than sit out its
    // ceiling holding the workspace.
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("stopped waiting");
  });

  it("says so rather than silently succeeding when given no change", async () => {
    const root = await temporaryRoot();

    const result = await runChainStep("await-change", undefined, ctx(root));

    // Refused at configuration time, so this is a defect path — but a
    // step that did nothing quietly would be worse than one that says it
    // was given nothing.
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("no change to wait for");
  });

  it("is a waiting step, so the chain knows not to charge its time", () => {
    expect(isWaitingStep("await-change")).toBe(true);
  });
});
