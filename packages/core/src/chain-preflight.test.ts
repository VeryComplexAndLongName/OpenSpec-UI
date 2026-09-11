import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveChainStart } from "./chain-preflight.js";
import type { AgentRunner } from "./agent-runner.js";

// every-varying-check-has-a-budget: every test here is a few small file
// writes and one config read. Measured 2026-09-11 at under 60ms for the
// slowest; the ceiling is for a loaded machine, not for this work.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-chain-preflight-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A runner that fails the test if anything ever asks it to run. Every
 * refusal below asserts this: the point of resolving first is that a
 * refused run has spent nothing, and a resolver that quietly invoked
 * something would still return the right refusal. */
function neverRuns(): AgentRunner {
  return {
    run() {
      throw new Error("a refused run must never invoke an agent");
    },
  } as unknown as AgentRunner;
}

async function makeChange(
  root: string,
  changeName: string,
  harness?: Record<string, unknown>,
): Promise<void> {
  const changeDir = path.join(root, "openspec", "changes", changeName);
  await mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, "proposal.md"), "# A change\n\n## Why\n\nBecause.\n", "utf8");
  await writeFile(path.join(changeDir, "tasks.md"), "- [ ] 1.1 Do the thing\n", "utf8");
  if (harness) {
    await writeFile(path.join(changeDir, "harness.json"), JSON.stringify(harness, null, 2), "utf8");
  }
}

const anyAgent = (): AgentRunner => neverRuns();

describe("resolveChainStart", () => {
  it("permits a change whose configuration runs unattended", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", {
      autonomyLevel: "semi-autonomous",
      checkpoints: { requireConfirmationBetweenSteps: false },
    });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: false,
      resolveRunner: anyAgent,
    });

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.config.autonomyLevel).toBe("semi-autonomous");
      expect(resolution.changeDir).toBe(path.join(root, "openspec", "changes", "a-change"));
    }
  });

  it("refuses a change that does not exist", async () => {
    const root = await temporaryRoot();

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "never-proposed",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) {
      expect(resolution.refusal.reason).toContain("no active change named \"never-proposed\"");
      // Nothing governs this one, so nothing is named: a key here would
      // send the reader to edit a file that is not the problem.
      expect(resolution.refusal.configKey).toBeUndefined();
    }
  });

  it("refuses a name that is not a change name at all", async () => {
    const root = await temporaryRoot();

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "../../etc",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) expect(resolution.refusal.reason).toContain("is not a valid change name");
  });

  it("refuses a change whose autonomy level starts one stage at a time", async () => {
    const root = await temporaryRoot();
    // `assisted` is the default, so this is also the case a change with
    // no harness.json at all falls into.
    await makeChange(root, "a-change");

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) {
      expect(resolution.refusal.reason).toContain("\"assisted\"");
      expect(resolution.refusal.configKey).toBe("autonomyLevel");
    }
  });

  it("refuses a change that pauses for confirmation when nobody can answer", async () => {
    const root = await temporaryRoot();
    // No `checkpoints` key: absent means confirmation required, which is
    // what the chain runner reads it as too.
    await makeChange(root, "a-change", { autonomyLevel: "semi-autonomous" });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: false,
      resolveRunner: anyAgent,
    });

    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) {
      expect(resolution.refusal.configKey).toBe("checkpoints.requireConfirmationBetweenSteps");
      // The refusal has to be actionable: it names the file the reader
      // would edit, not only the setting.
      expect(resolution.refusal.reason).toContain("openspec/changes/a-change/harness.json");
    }
  });

  it("permits that same change when somebody can answer", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", { autonomyLevel: "semi-autonomous" });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    expect(resolution.ok).toBe(true);
  });

  it("refuses a stage whose agent this build has no runner for, before the first stage", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", {
      autonomyLevel: "autonomous",
      stepAgents: { propose: "claude-cli", apply: "codex-cli" },
    });

    // The shape that used to cost two stages: everything resolves except
    // the agent a later stage names.
    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: (agentId) => (agentId === "codex-cli" ? undefined : neverRuns()),
    });

    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) {
      expect(resolution.refusal.reason).toContain("\"apply\"");
      expect(resolution.refusal.reason).toContain("codex-cli");
      expect(resolution.refusal.configKey).toBe("stepAgents.apply");
    }
  });

  it("refuses when there is no default runner for a stage that names no agent", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", { autonomyLevel: "autonomous" });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: () => undefined,
    });

    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) expect(resolution.refusal.reason).toContain("no default runner");
  });

  it("refuses a configuration that cannot be read, naming what is wrong with it", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change");
    await writeFile(
      path.join(root, "openspec", "changes", "a-change", "harness.json"),
      "{ not json",
      "utf8",
    );

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) {
      expect(resolution.refusal.reason).toContain("harness configuration could not be read");
    }
  });
});
