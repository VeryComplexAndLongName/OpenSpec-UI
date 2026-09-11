import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveChainStart } from "./chain-preflight.js";
import { checkChangeGraph, readChangeGraph } from "./change-graph.js";
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

describe("resolveChainStart — declared steps", () => {
  it("refuses a change that waits for itself, before anything runs", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", {
      autonomyLevel: "autonomous",
      steps: [{ step: "await-change", before: "verify", param: "a-change" }],
    });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) {
      expect(resolution.refusal.reason).toContain("is this change itself");
      expect(resolution.refusal.configKey).toBe("steps[0].param");
    }
  });

  it("does not refuse a wait on a change that does not exist yet", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", {
      autonomyLevel: "autonomous",
      steps: [{ step: "await-change", before: "verify", param: "not-proposed-yet" }],
    });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    // A change that has not been proposed yet is exactly the case a wait
    // is for. Refusing here would make the declaration useless for the
    // schedule it describes.
    expect(resolution.ok).toBe(true);
  });

  it("refuses a declaration the configuration itself rejects, as a configuration error", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", {
      autonomyLevel: "autonomous",
      steps: [{ step: "await-nothing", before: "verify" }],
    });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    // Reached through the configuration read, so a misspelled step name
    // late in the chain still costs nothing: no agent was invoked, and
    // `anyAgent` throws if one ever is.
    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) expect(resolution.refusal.reason).toContain("could not be read");
  });
});

describe("resolveChainStart — a declared blocker (a-declared-blocker-blocks)", () => {
  /** A change whose `.openspec.yaml` carries relations. */
  async function makeChangeWithRelations(
    root: string,
    changeName: string,
    options: { blockedBy?: string[]; harness?: Record<string, unknown>; archived?: boolean } = {},
  ): Promise<void> {
    const base = options.archived
      ? path.join(root, "openspec", "changes", "archive", `2026-09-11-${changeName}`)
      : path.join(root, "openspec", "changes", changeName);
    await mkdir(base, { recursive: true });
    await writeFile(path.join(base, "proposal.md"), "# A change\n\n## Why\n\nBecause.\n", "utf8");
    await writeFile(path.join(base, "tasks.md"), "- [ ] 1.1 Do the thing\n", "utf8");
    const relations = (options.blockedBy ?? []).map((name) => `  - ${name}`).join("\n");
    await writeFile(
      path.join(base, ".openspec.yaml"),
      `schema: spec-driven\ncreated: 2026-09-11\n${relations ? `blocked_by:\n${relations}\n` : ""}`,
      "utf8",
    );
    if (options.harness) {
      await writeFile(path.join(base, "harness.json"), JSON.stringify(options.harness, null, 2), "utf8");
    }
  }

  const RUNS_UNATTENDED = { autonomyLevel: "autonomous" } as const;

  it("refuses a chain whose blocker is still active, naming it", async () => {
    const root = await temporaryRoot();
    await makeChangeWithRelations(root, "the-blocker");
    await makeChangeWithRelations(root, "a-change", { blockedBy: ["the-blocker"], harness: RUNS_UNATTENDED });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) {
      expect(resolution.refusal.reason).toContain("the-blocker");
      // The remedy is not a setting, so nothing points at one.
      expect(resolution.refusal.configKey).toBeUndefined();
    }
  });

  it("starts once the blocker has been archived", async () => {
    const root = await temporaryRoot();
    await makeChangeWithRelations(root, "the-blocker", { archived: true });
    await makeChangeWithRelations(root, "a-change", { blockedBy: ["the-blocker"], harness: RUNS_UNATTENDED });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    expect(resolution.ok).toBe(true);
  });

  it("does not hold a run on a blocker that names nothing that exists", async () => {
    // That is a fault in the declaration, reported as one by the check
    // that validates relations. Holding the run on it would hide a
    // fault behind something that reads as a schedule.
    const root = await temporaryRoot();
    await makeChangeWithRelations(root, "a-change", { blockedBy: ["never-proposed"], harness: RUNS_UNATTENDED });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    expect(resolution.ok).toBe(true);
  });

  it("names every unmet blocker, not just the first", async () => {
    // A reader who lands one and is refused again for the next was told
    // half the truth.
    const root = await temporaryRoot();
    await makeChangeWithRelations(root, "first-blocker");
    await makeChangeWithRelations(root, "second-blocker");
    await makeChangeWithRelations(root, "a-change", {
      blockedBy: ["first-blocker", "second-blocker"],
      harness: RUNS_UNATTENDED,
    });

    const resolution = await resolveChainStart({
      workspaceRoot: root,
      changeName: "a-change",
      canAnswerCheckpoints: true,
      resolveRunner: anyAgent,
    });

    expect(resolution).toMatchObject({ ok: false });
    if (!resolution.ok) {
      expect(resolution.refusal.reason).toContain("first-blocker");
      expect(resolution.refusal.reason).toContain("second-blocker");
    }
  });

  it("leaves the validation gate alone: a blocked change is still valid", async () => {
    // The run gate and the validation gate are one word apart in
    // conversation, and a future reader will try to "fix" the
    // inconsistency. A change declaring a blocker states a plan, and a
    // plan not yet carried out is not a defect.
    const root = await temporaryRoot();
    await makeChangeWithRelations(root, "the-blocker");
    await makeChangeWithRelations(root, "a-change", { blockedBy: ["the-blocker"] });

    const violations = checkChangeGraph(await readChangeGraph(root));

    expect(violations).toEqual([]);
  });
});
