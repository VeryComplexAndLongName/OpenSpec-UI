import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AgentAdapter, type AgentRunner, createAgentRunner } from "./agent-runner.js";
import { DEFAULT_AGENT_ID } from "./agents/registry.js";
import { buildChangeCostReport } from "./change-cost-report.js";
import { recommendTemplate } from "./harness-recommendation.js";
import { buildWorkspaceRunStats } from "./workspace-run-stats.js";
import type { PullRequestGateway } from "./gh-pr-gateway.js";
import type { GitWrapper } from "./git.js";
import type { Command, Event } from "./protocol.js";
import { writeChangeHarnessConfig, writeGlobalHarnessConfig } from "./harness-config.js";
import type { AllowlistConfig } from "./security.js";
import { FileAuditLog, InMemoryAuditLog, auditLogPath, type AuditEntry } from "./security.js";

// every-varying-check-has-a-budget:
// measured 2026-09-05 at 1.0s idle and 19.0s under deliberate 8-worker
// CPU co-load, for its slowest single test across two such runs.
vi.setConfig({ testTimeout: 60_000 });

// `HarnessChainRunner` shells out to the real `openspec` CLI for
// `statusChange`/`archiveChange` (via `openspec.ts`) — mock `cross-spawn`
// the same way `openspec.test.ts` does, rather than mocking this module's
// own boundary functions, so the real JSON-parsing/validation path is
// still exercised.
class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

const spawnMock = vi.fn();
vi.mock("cross-spawn", () => ({
  default: (...args: unknown[]) => spawnMock(...args),
}));

const { HarnessChainRunner } = await import("./harness-chain-runner.js");
const harnessConfigModule = await import("./harness-config.js");

/** Queues one fake CLI invocation. Unlike scheduling `queueMicrotask` at
 * setup time (which races ahead of `execFileAsync` actually attaching its
 * listeners when more than one call is queued before the code under test
 * runs), the child is created — and its emission scheduled — only once
 * `crossSpawn` is actually invoked, so `execFileAsync`'s synchronous
 * `.on("data")`/`.on("close")` listener attachment always happens first. */
function mockCliJson(stdout: unknown): void {
  spawnMock.mockImplementationOnce(() => {
    const child = new FakeChildProcess();
    queueMicrotask(() => {
      child.stdout.emit("data", Buffer.from(JSON.stringify(stdout), "utf8"));
      child.emit("close", 0);
    });
    return child;
  });
}

/** `openspec status --change <name> --json` shape as this repository's CLI
 * actually emits it (see `openspec-fixtures/status.json`) — `proposeDone`
 * controls whether `proposal`/`design`/`tasks` all report `"done"`, i.e.
 * whether those FILES EXIST. No `progress` field: the real CLI reports
 * none for a change, which is exactly why the chain must not depend on it
 * (see openspec/changes/harness-chain-archive-gate/proposal.md). */
function statusFixture(proposeDone: boolean): unknown {
  const artifactStatus = proposeDone ? "done" : "pending";
  return {
    changeName: "demo",
    schemaName: "spec-driven",
    artifacts: [
      { id: "proposal", outputPath: "proposal.md", status: artifactStatus, requires: [] },
      { id: "design", outputPath: "design.md", status: artifactStatus, requires: [] },
      { id: "tasks", outputPath: "tasks.md", status: artifactStatus, requires: [] },
    ],
    root: { path: "/workspace", source: "cwd" },
  };
}

function mockStatus(proposeDone: boolean): void {
  mockCliJson(statusFixture(proposeDone));
}

/** The shape a change with no `design.md` reports: everything else done,
 * the design `ready` — the CLI's word for an artifact it could produce,
 * including one nobody intends to write. Read from this repository on
 * 2026-09-09 for `dialog-shows-what-runs-cost`. See
 * design-is-optional-for-resume. */
function mockStatusWithoutDesign(): void {
  mockCliJson({
    changeName: "demo",
    schemaName: "spec-driven",
    artifacts: [
      { id: "proposal", outputPath: "proposal.md", status: "done", requires: [] },
      { id: "design", outputPath: "design.md", status: "ready", requires: [] },
      { id: "tasks", outputPath: "tasks.md", status: "done", requires: [] },
    ],
    root: { path: "/workspace", source: "cwd" },
  });
}

/** Writes `openspec/changes/demo/tasks.md` with `unchecked` incomplete and
 * `checked` complete task lines — the only signal the chain is now allowed
 * to read for "is the implementation done". */
async function writeTasks(root: string, unchecked: number, checked: number): Promise<void> {
  const changeDir = path.join(root, "openspec", "changes", "demo");
  await mkdir(changeDir, { recursive: true });
  const lines = [
    "## 1. Tasks",
    "",
    ...Array.from({ length: checked }, (_, index) => `- [x] 1.${index + 1} done`),
    ...Array.from({ length: unchecked }, (_, index) => `- [ ] 2.${index + 1} not done`),
    "",
  ];
  await writeFile(path.join(changeDir, "tasks.md"), lines.join("\n"), "utf8");
}

function mockArchiveSucceeds(onArchive?: () => void | Promise<void>): void {
  spawnMock.mockImplementationOnce(() => {
    const child = new FakeChildProcess();
    queueMicrotask(async () => {
      await onArchive?.();
      child.stdout.emit("data", Buffer.from("{}", "utf8"));
      child.emit("close", 0);
    });
    return child;
  });
}

/** A fake `AgentRunner` whose `run()` yields `started` then `completed` for
 * any command except one whose `kind === "cancel"`, which yields nothing
 * (matching the product's real cancel semantics closely enough for these
 * tests — see harness-chain-runner.ts's `cancel()` doc comment). Records
 * every command it was asked to run. */
function makeCompletingRunner(): { runner: AgentRunner; calls: Command[] } {
  const calls: Command[] = [];
  const runner: AgentRunner = {
    async *run(command) {
      calls.push(command);
      if (command.kind === "cancel") return;
      yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
      yield { kind: "completed", runId: command.runId, timestamp: "t", summary: `${command.kind} done` };
    },
  };
  return { runner, calls };
}

const temporaryRoots: string[] = [];

// `vi.waitFor`'s own ceiling, which is a second budget the file states
// and neither `testTimeout` nor the budget-policy check can see: when it
// expires, the last event read is compared against the expected one and
// the test reports an assertion mismatch, not a timeout.
//
// Measured 2026-09-02 for "confirming a checkpoint resumes into the next
// stage's agent": ~453ms isolated, and ~1823ms during deliberate
// full-suite co-load, from which 5000 ms was chosen.
//
// every-varying-check-has-a-budget, 2026-09-05: that test reached 5978ms
// under deliberate 8-worker CPU co-load and failed against the 5000 ms
// above — "expected { kind: 'started' } to match object { kind:
// 'completed' }", which reads as a broken assertion and is not one. With
// the ceiling lifted it took 4240ms and 2358ms on two such runs. Sized
// from the worst of those.
const CHAIN_WAIT_FOR_TIMEOUT_MS = 20_000;

async function waitForChain(assertion: () => void | Promise<void>, expectation: string): Promise<void> {
  try {
    await vi.waitFor(assertion, { timeout: CHAIN_WAIT_FOR_TIMEOUT_MS });
  } catch (error) {
    throw new Error(
      `Timed out after ${CHAIN_WAIT_FOR_TIMEOUT_MS} ms while waiting for ${expectation}. This hit vi.waitFor's ceiling, not an assertion regression.`,
      { cause: error },
    );
  }
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-harness-chain-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function baseCommand(cwd: string): Command {
  return {
    kind: "chain",
    cwd,
    runId: "chain-run-1",
    context: { changeDir: path.join(cwd, "openspec", "changes", "demo") },
  };
}

function makeGitStageDeps(options: {
  branch?: string;
  createPrError?: string;
  checksState?: "pass" | "fail" | "none";
  checksReason?: string;
} = {}) {
  const calls = {
    gitPush: 0,
    prCreate: 0,
    prMerge: 0,
  };
  const git: GitWrapper = {
    status: vi.fn(),
    diff: vi.fn(),
    commit: vi.fn(),
    currentBranch: vi.fn(async () => options.branch ?? "feature/demo"),
    push: vi.fn(async () => {
      calls.gitPush += 1;
    }),
    // The git stage touches none of these. They are here because the
    // wrapper is one interface, and a partial fake would compile only by
    // being cast — which is how a fake stops matching what it fakes.
    worktreeList: vi.fn(async () => []),
    worktreeAdd: vi.fn(async () => undefined),
    worktreeMove: vi.fn(async () => undefined),
    worktreeRemove: vi.fn(async () => undefined),
    pathExistsInRef: vi.fn(async () => true),
    changedFilesBetween: vi.fn(async () => []),
    remoteUrl: vi.fn(async () => undefined),
    configuredIdentity: vi.fn(async () => undefined),
  };
  const gateway: PullRequestGateway = {
    createPullRequest: vi.fn(async () => {
      calls.prCreate += 1;
      if (options.createPrError) throw new Error(options.createPrError);
      return { number: 7, url: "https://github.com/example/repo/pull/7" };
    }),
    waitForChecks: vi.fn(async () => ({ state: options.checksState ?? "pass", reason: options.checksReason })),
    mergePullRequest: vi.fn(async () => {
      calls.prMerge += 1;
    }),
  };

  return {
    calls,
    deps: {
      createGitWrapper: () => git,
      createPullRequestGateway: () => gateway,
    },
    gateway,
    git,
  };
}

describe("HarnessChainRunner — assisted level", () => {
  it("refuses to run a chain when the resolved autonomyLevel is assisted", async () => {
    const root = await temporaryRoot();
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.map((e) => e.kind)).toEqual(["started", "failed"]);
    expect(events[1]).toMatchObject({ reason: expect.stringContaining("assisted") });
  });
});

describe("HarnessChainRunner — semi-autonomous", () => {
  it("runs propose -> review -> apply -> verify -> archive with a checkpoint at each transition", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli", verify: "claude-cli" },
    });
    mockStatus(false); // propose not done yet -> chain starts at "propose"
    // The chain refuses to archive while any task is unchecked, and the
    // fake agent below does not edit tasks.md — write it already complete.
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    const checkpoints = events.filter((e) => e.kind === "checkpoint");
    expect(checkpoints.map((e) => (e as { stage: string; nextStage: string }).stage)).toEqual([
      "propose",
      "review",
      "apply",
      "verify",
    ]);
    expect(checkpoints.map((e) => (e as { nextStage: string }).nextStage)).toEqual([
      "review",
      "apply",
      "verify",
      "archive",
    ]);
    // Intermediate stages' own raw "completed" events are swallowed, not forwarded.
    expect(events.filter((e) => e.kind === "completed")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(events.some((e) => e.kind === "stageCompleted")).toBe(false);
  });

  it("cancelling at a checkpoint ends the chain without starting the next stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const generator = chain.run(command);
    const { events } = await collectUntilThenAct(generator, (e) => e.kind === "checkpoint", () => {
      expect(chain.cancel(command.runId)).toBe(true);
    });

    expect(events.at(-1)).toMatchObject({ kind: "cancelled" });
    // Only the "propose" stage ran (mapped to "plan") — review never started.
    expect(calls.map((c) => c.kind)).toEqual(["plan"]);
  });

  it("confirming a checkpoint resumes into the next stage's agent", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const generator = chain.run(command);
    void (async () => {
      for await (const event of generator) {
        events.push(event);
        if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
      }
    })();

    await waitForChain(
      () => expect(events.at(-1)).toMatchObject({ kind: "completed" }),
      "the chain to reach the final completed event after checkpoint confirmations",
    );
    expect(calls.map((c) => c.kind)).toEqual(["plan", "review", "implement", "verify"]);
  });

  it("a paused chain does not silently complete while waiting at a checkpoint", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();

    await waitForChain(
      () => expect(events.some((e) => e.kind === "checkpoint")).toBe(true),
      "the first checkpoint before confirming it",
    );
    expect(events.some((e) => e.kind === "completed" || e.kind === "failed" || e.kind === "cancelled")).toBe(false);
    // Still genuinely tracked (not garbage-collected/forgotten) — confirming resumes it.
    expect(chain.confirmCheckpoint(command.runId)).toBe(true);

    // Resuming runs "review" and pauses at the next checkpoint too — still
    // not silently complete. End the test here (not the concern of this
    // test) via cancel, rather than draining the whole sequence.
    await waitForChain(
      () => expect(events.filter((e) => e.kind === "checkpoint")).toHaveLength(2),
      "the second checkpoint after one confirm",
    );
    expect(events.some((e) => e.kind === "completed" || e.kind === "failed" || e.kind === "cancelled")).toBe(false);
    expect(chain.cancel(command.runId)).toBe(true);
    await pump;
  });
});

describe("HarnessChainRunner — autonomous", () => {
  it("runs the full sequence with no checkpoints when the per-change file itself sets autonomous", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(false);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.some((e) => e.kind === "checkpoint")).toBe(false);
    expect(events.filter((e) => e.kind === "stageCompleted").map((e) => (e as { stage: string }).stage)).toEqual([
      "propose",
      "review",
      "apply",
      "verify",
    ]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(calls.map((c) => c.kind)).toEqual(["plan", "review", "implement", "verify"]);
  });

  it("refuses autonomous when the independently re-read per-change file does not itself confirm it", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });

    // Simulate a merge-layer bug: resolveHarnessConfig legitimately says
    // "autonomous" (real per-change file), but harness-chain-runner's own
    // independent re-check of readChangeHarnessConfig disagrees — this
    // must still be refused, not trusted from the merged config alone.
    const spy = vi.spyOn(harnessConfigModule, "readChangeHarnessConfig").mockResolvedValueOnce(undefined);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.map((e) => e.kind)).toEqual(["started", "failed"]);
    expect(events[1]).toMatchObject({ reason: expect.stringContaining("autonomous") });
    spy.mockRestore();
  });
});

describe("HarnessChainRunner — git stage gating", () => {
  it("under human-required, stops after archive and never executes git actions", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
    });
    mockStatus(true); // every propose artifact exists
    await writeTasks(root, 0, 3); // ...and every task is checked -> starts at "verify"
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const gitStage = makeGitStageDeps();
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      ...gitStage.deps,
    });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    // Only "verify" ran through an AgentRunner — archive is mechanical, and
    // the default review gate still blocks the git stage.
    expect(calls.map((c) => c.kind)).toEqual(["verify"]);
    expect(gitStage.calls.gitPush).toBe(0);
    expect(gitStage.calls.prCreate).toBe(0);
    expect(gitStage.calls.prMerge).toBe(0);
  });

  it("under agent-sufficient plus allowlist, runs git push -> pr create -> merge", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { verify: "claude-cli" },
    });
    await writeChangeHarnessConfig(root, "demo", {
      reviewGate: { mode: "agent-sufficient" },
      gitStageAllowlist: { remotes: ["origin"], branches: ["main", "feature/*"] },
    });
    mockStatus(true);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds(async () => {
      const archiveRoot = path.join(root, "openspec", "changes", "archive");
      await mkdir(archiveRoot, { recursive: true });
      await rename(
        path.join(root, "openspec", "changes", "demo"),
        path.join(archiveRoot, "demo"),
      );
    });

    const { runner, calls } = makeCompletingRunner();
    const gitStage = makeGitStageDeps();
    const auditLog = new InMemoryAuditLog();
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      auditLog,
      ...gitStage.deps,
    });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(calls.map((c) => c.kind)).toEqual(["verify"]);
    expect(gitStage.calls.gitPush).toBe(1);
    expect(gitStage.calls.prCreate).toBe(1);
    expect(gitStage.calls.prMerge).toBe(1);
    expect(auditLog.entries.filter((entry) => entry.agent === "git-stage" && entry.outcome === "completed")).toHaveLength(3);
  });

  it("blocks a non-allowlisted git target before any push/pr/merge call", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { verify: "claude-cli" },
    });
    await writeChangeHarnessConfig(root, "demo", {
      reviewGate: { mode: "agent-sufficient" },
      gitStageAllowlist: { remotes: ["upstream"], branches: ["release/*"] },
    });
    mockStatus(true);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const gitStage = makeGitStageDeps();
    const auditLog = new InMemoryAuditLog();
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      auditLog,
      ...gitStage.deps,
    });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as { reason: string }).reason).toContain("allowlist");
    expect(gitStage.calls.gitPush).toBe(0);
    expect(gitStage.calls.prCreate).toBe(0);
    expect(gitStage.calls.prMerge).toBe(0);
    expect(auditLog.entries.some((entry) => entry.agent === "git-stage" && entry.outcome === "blocked")).toBe(true);
  });

  it("fails with a PR-creation-specific reason when push succeeds but PR creation fails", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { verify: "claude-cli" },
    });
    await writeChangeHarnessConfig(root, "demo", {
      reviewGate: { mode: "agent-sufficient" },
      gitStageAllowlist: { remotes: ["origin"], branches: ["main", "feature/*"] },
    });
    mockStatus(true);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const gitStage = makeGitStageDeps({ createPrError: "pr create exploded" });
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      ...gitStage.deps,
    });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(gitStage.calls.gitPush).toBe(1);
    expect(gitStage.calls.prCreate).toBe(1);
    expect(gitStage.calls.prMerge).toBe(0);
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as { reason: string }).reason).toContain("pull-request creation");
  });

  it("refuses merge when checks fail", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { verify: "claude-cli" },
    });
    await writeChangeHarnessConfig(root, "demo", {
      reviewGate: { mode: "agent-sufficient" },
      gitStageAllowlist: { remotes: ["origin"], branches: ["main", "feature/*"] },
    });
    mockStatus(true);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const gitStage = makeGitStageDeps({ checksState: "fail", checksReason: "check failed: lint" });
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      ...gitStage.deps,
    });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(gitStage.calls.gitPush).toBe(1);
    expect(gitStage.calls.prCreate).toBe(1);
    expect(gitStage.calls.prMerge).toBe(0);
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as { reason: string }).reason).toContain("pull-request checks");
  });

  it("refuses merge when no check result is available", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { verify: "claude-cli" },
    });
    await writeChangeHarnessConfig(root, "demo", {
      reviewGate: { mode: "agent-sufficient" },
      gitStageAllowlist: { remotes: ["origin"], branches: ["main", "feature/*"] },
    });
    mockStatus(true);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const gitStage = makeGitStageDeps({ checksState: "none", checksReason: "no check result was available" });
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      ...gitStage.deps,
    });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(gitStage.calls.gitPush).toBe(1);
    expect(gitStage.calls.prCreate).toBe(1);
    expect(gitStage.calls.prMerge).toBe(0);
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as { reason: string }).reason).toContain("no check result was available");
  });
});

describe("HarnessChainRunner — verify stage (task 5.1/5.6)", () => {
  it("resolves stepAgents.verify's configured agent for the verify stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { verify: "gemini-cli" },
    });
    mockStatus(true);
    await writeTasks(root, 0, 3); // every task checked -> starts at "verify"
    mockArchiveSucceeds();

    const resolvedAgentIds: (string | undefined)[] = [];
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({
      resolveRunner: (agentId) => {
        resolvedAgentIds.push(agentId);
        return runner;
      },
    });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(resolvedAgentIds).toEqual(["gemini-cli"]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("resolves the default (undefined) agent for the verify stage when stepAgents.verify is unset", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(true);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const resolvedAgentIds: (string | undefined)[] = [];
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({
      resolveRunner: (agentId) => {
        resolvedAgentIds.push(agentId);
        return runner;
      },
    });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(resolvedAgentIds).toEqual([undefined]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });

  /** Proves this change relies on the pre-existing archive gate rather
   * than duplicating it: HarnessChainRunner has no verify-specific outcome
   * handling at all — it just runs the verify stage and lets the SAME
   * task-count check that already guards `archive` re-read tasks.md. */
  it("stops before archive when the verify run leaves an unchecked task behind", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(true);
    await writeTasks(root, 0, 3); // every task checked -> starts at "verify"

    const calls: Command[] = [];
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        if (command.kind === "cancel") return;
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        if (command.kind === "verify") {
          // The verifying agent finds an overstated task and unchecks it —
          // by editing tasks.md itself, exactly as a real CLI agent would.
          await writeTasks(root, 1, 2);
        }
        yield { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(calls.map((c) => c.kind)).toEqual(["verify"]);
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as { reason: string }).reason).toContain("1 task(s) still unchecked");
    expect(spawnMock.mock.calls.some((call) => (call[1] as string[])[0] === "archive")).toBe(false);
  });
});

/** `changeset-present` is used throughout this block deliberately — it is
 * the one registered check that needs no `cross-spawn` mock at all (it
 * only reads `.changeset/` from disk via `checkChangesetReminder`), so
 * these tests exercise the real registry function end to end without
 * fighting this file's spawn-call-ordering constraints (see
 * `mockCliJson`'s own comment on why timing matters there). */
async function setupChangeset(root: string, pending: boolean): Promise<void> {
  const changesetDir = path.join(root, ".changeset");
  await mkdir(changesetDir, { recursive: true });
  await writeFile(path.join(changesetDir, "config.json"), "{}", "utf8");
  if (pending) {
    await writeFile(path.join(changesetDir, "demo-change.md"), "---\n---\n\nSummary\n", "utf8");
  }
}

async function writeTasksRaw(root: string, content: string): Promise<void> {
  const changeDir = path.join(root, "openspec", "changes", "demo");
  await mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, "tasks.md"), content, "utf8");
}

async function readTasksRaw(root: string): Promise<string> {
  return readFile(path.join(root, "openspec", "changes", "demo", "tasks.md"), "utf8");
}

describe("HarnessChainRunner — mechanical checks in the verify stage (tasks 5.2-5.4)", () => {
  it("a passing check marks its task and the verifying agent still runs", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli", verify: "claude-cli" },
    });
    mockStatus(true); // propose already done; the one task below is unchecked -> starts at "apply"
    await setupChangeset(root, true);
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(calls.map((c) => c.kind)).toEqual(["implement", "verify"]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(await readTasksRaw(root)).toContain("- [x] 1.1 has a changeset.");
    // task 3.4: the passing result is handed to the verifying agent's own
    // prompt, so it is told what already ran rather than repeating it.
    expect(calls[1]?.context.promptContext).toContain("changeset-present");
    expect(calls[1]?.context.promptContext).toContain("already ran and passed");
  });

  it("a failing check ends the stage as failed, names the failing check, and never invokes the agent", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli", verify: "claude-cli" },
    });
    mockStatus(true);
    await setupChangeset(root, false); // no pending changeset file -> the check fails
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    // "apply" ran (the fake agent completes it, moving the chain into
    // "verify"); "verify" itself never reached its agent — the failing
    // check stopped the stage first.
    expect(calls.map((c) => c.kind)).toEqual(["implement"]);
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as { reason: string }).reason).toContain("changeset-present");
    expect((events.at(-1) as { reason: string }).reason).toContain("verifying agent was not invoked");
    expect(await readTasksRaw(root)).toContain("- [ ] 1.1 has a changeset.");
  });

  it("an agent's own completion report never marks a checked task the check itself did not pass", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli", verify: "claude-cli" },
    });
    mockStatus(true);
    await setupChangeset(root, false); // the check will fail
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));

    // If this runner's "verify" branch ever ran, it would claim the task
    // done in its own summary — proving the harness never reads that
    // summary to decide a checked task's checkbox (task 3.2/5.3). Because
    // the check fails first, this branch must never execute at all.
    const calls: Command[] = [];
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        if (command.kind === "cancel") return;
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        yield { kind: "completed", runId: command.runId, timestamp: "t", summary: "1.1 has a changeset: done" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(calls.map((c) => c.kind)).toEqual(["implement"]);
    expect(await readTasksRaw(root)).toContain("- [ ] 1.1 has a changeset.");
  });

  it("a change declaring no checks behaves exactly as before this capability existed", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", stepAgents: { verify: "claude-cli" } });
    mockStatus(true);
    await writeTasks(root, 0, 3); // every task checked, none declares a check -> starts at "verify"
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(calls.map((c) => c.kind)).toEqual(["verify"]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });
});

describe("HarnessChainRunner — task completion gates the chain", () => {
  /** The incident of 2026-09-01, as a test: every artifact file existed, so
   * the old code read artifact presence as "no tasks remain" and went
   * straight to `archive`, archiving a change with 0 of 23 tasks done. */
  it("starts at apply, not archive, when every artifact exists but no task is checked", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true);
    await writeTasks(root, 3, 0);

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(calls.map((c) => c.kind)).toEqual(["implement", "verify"]);
    // Only `openspec status` ran — no `openspec archive` (verify's fake run
    // doesn't check any task, so the archive gate still refuses).
    expect(spawnMock.mock.calls.map((call) => (call[1] as string[])[0])).toEqual(["status"]);
  });

  it("starts at verify, not archive, when every task is checked", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(true);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(calls.map((c) => c.kind)).toEqual(["verify"]);
    expect(spawnMock.mock.calls.map((call) => (call[1] as string[])[0])).toEqual(["status", "archive"]);
  });

  it("starts at apply when tasks.md cannot be read at all", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true); // no tasks.md written -> task completion is unknown

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(calls.map((c) => c.kind)).toEqual(["implement", "verify"]);
    expect(spawnMock.mock.calls.map((call) => (call[1] as string[])[0])).toEqual(["status"]);
  });

  it("refuses to archive when tasks remain unchecked, naming the change and the count", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true);
    await writeTasks(root, 2, 1);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    // The chain started at `apply` (tasks unchecked) and then refused to
    // archive — the stage completing successfully is not evidence of work.
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    const reason = (events.at(-1) as { reason: string }).reason;
    expect(reason).toContain("demo");
    expect(reason).toContain("2 task(s) still unchecked");
    expect(spawnMock.mock.calls.some((call) => (call[1] as string[])[0] === "archive")).toBe(false);
  });

  it("refuses to archive when the task count cannot be determined", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true);
    await writeTasks(root, 1, 0);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    // Remove tasks.md after the start-stage decision has been made, so the
    // archive gate itself is the code path facing an unreadable file.
    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) {
      events.push(event);
      if (event.kind === "started" && event.command === "implement") {
        await rm(path.join(root, "openspec", "changes", "demo", "tasks.md"), { force: true });
      }
    }

    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as { reason: string }).reason).toContain("demo");
    expect(spawnMock.mock.calls.some((call) => (call[1] as string[])[0] === "archive")).toBe(false);
  });
});

describe("HarnessChainRunner — verify sends work back (verify-sends-work-back)", () => {
  /** A runner that completes every stage without touching tasks.md, so
   * the task list stays exactly as the test wrote it. */
  function silentRunner(calls: Command[]): AgentRunner {
    return {
      async *run(command) {
        calls.push(command);
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        yield { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
  }

  it("returns to apply when verify leaves tasks unchecked, saying why", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", maxStageAttempts: 2 });
    // `autonomous` is per-change only — a global file setting it is
    // rejected outright, which is the rule this repository documents.
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true); // proposal/design/tasks exist, so the chain starts at apply
    await writeTasks(root, 2, 1);

    const calls: Command[] = [];
    const chain = new HarnessChainRunner({ resolveRunner: () => silentRunner(calls) });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    const applyStarts = events.filter((e) => e.kind === "stageStarted" && e.stage === "apply");
    expect(applyStarts.length).toBe(2);
    expect((applyStarts[1] as { attempt?: number }).attempt).toBe(2);
    expect((applyStarts[1] as { previousAttemptReason?: string }).previousAttemptReason)
      .toContain("2 task(s) unchecked");
  });

  it("stops and names the unchecked tasks once apply has used its attempts", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", maxStageAttempts: 2 });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true);
    await writeTasks(root, 1, 1);

    const calls: Command[] = [];
    const chain = new HarnessChainRunner({ resolveRunner: () => silentRunner(calls) });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    const failed = events.find((e) => e.kind === "failed");
    expect(failed).toBeDefined();
    // Named, not counted: the reader is about to take this over.
    expect((failed as { reason: string }).reason).toContain("2.1 not done");
    expect((failed as { reason: string }).reason).toContain("all 2 of its attempts");
  });

  it("does not run apply in a chain that was entered at verify", async () => {
    // Entered at verify because nothing was unchecked; verify then
    // unchecks one. There is no `apply` in this chain's sequence, and
    // running one nobody asked for would be the chain acting on its own.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", maxStageAttempts: 2 });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true);
    await writeTasks(root, 0, 2); // nothing unchecked -> the chain starts at verify

    const calls: Command[] = [];
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        // Stands in for a failing mechanical check, which is the only
        // thing that unchecks a task.
        if (command.kind === "verify") await writeTasks(root, 1, 1);
        yield { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.filter((e) => e.kind === "stageStarted" && e.stage === "apply")).toHaveLength(0);
    const failed = events.find((e) => e.kind === "failed");
    expect((failed as { reason: string }).reason).toContain('did not run "apply"');
  });

  it("spends attempts per stage, so one stage's returns do not exhaust another's", async () => {
    // apply runs twice because verify sent it back; verify must also be
    // allowed its second run. A single shared tally would have stopped it.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", maxStageAttempts: 2 });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true);
    await writeTasks(root, 2, 1);

    const calls: Command[] = [];
    const chain = new HarnessChainRunner({ resolveRunner: () => silentRunner(calls) });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    const starts = events.filter((e) => e.kind === "stageStarted");
    expect(starts.filter((e) => e.stage === "apply")).toHaveLength(2);
    expect(starts.filter((e) => e.stage === "verify")).toHaveLength(2);
  });

  it("leaves a chain that configures no attempts exactly as it was", async () => {
    // The regression to protect: today verify leaves the tasks unchecked
    // and archive refuses, and that must keep happening untouched.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true);
    await writeTasks(root, 1, 1);

    const calls: Command[] = [];
    const chain = new HarnessChainRunner({ resolveRunner: () => silentRunner(calls) });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.filter((e) => e.kind === "stageStarted" && e.stage === "apply")).toHaveLength(1);
    const failed = events.find((e) => e.kind === "failed");
    // archive's own refusal, unchanged — not a message this change added.
    expect((failed as { reason: string }).reason).toContain("cannot archive");
  });
});

describe("HarnessChainRunner — per-stage spend (stage-spend-is-bounded-and-recorded)", () => {
  function reportingRunner(usage: Record<string, number>): AgentRunner {
    return {
      async *run(command) {
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        yield { kind: "usageReported", runId: command.runId, timestamp: "t", usage };
        yield { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
  }

  it("stops the chain after a stage that reported more than the per-stage ceiling", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      budget: { maxStageCostUsd: 1 },
    });
    mockStatus(false);

    const chain = new HarnessChainRunner({ resolveRunner: () => reportingRunner({ costUsd: 4.5 }) });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    const failed = events.find((e) => e.kind === "failed");
    expect(failed).toBeDefined();
    expect((failed as { reason: string }).reason).toContain("maxStageCostUsd");
    expect((failed as { reason: string }).reason).toContain("$4.50");
  });

  it("does not stop the chain when the agent reported nothing to compare", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      budget: { maxStageCostUsd: 1 },
    });
    mockStatus(false);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();
    await waitForChain(
      () => expect(events.some((e) => e.kind === "checkpoint")).toBe(true),
      "the checkpoint after a stage the ceiling could not judge",
    );
    chain.cancel(command.runId);
    await pump;

    expect(events.some((e) => e.kind === "failed")).toBe(false);
  });

  it("passes the stage on the command, so a record can say which stage spent what", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const calls: Command[] = [];
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        yield { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();
    await waitForChain(() => expect(calls.length).toBeGreaterThan(0), "the first stage command");
    chain.cancel(command.runId);
    await pump;

    expect(calls[0]?.stage).toBe("propose");
  });
});

describe("HarnessChainRunner — time limits (run-has-a-time-limit)", () => {
  /** A runner whose stage hangs until released — the shape a stage that
   * has stopped making progress presents, which is what a time ceiling
   * exists to end. */
  function hangingRunner(): { runner: AgentRunner; calls: Command[]; release: () => void } {
    let releaseStage: (() => void) | undefined;
    const calls: Command[] = [];
    let cancelSignalled = false;
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        if (command.kind === "cancel") {
          cancelSignalled = true;
          releaseStage?.();
          return;
        }
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        await new Promise<void>((resolve) => {
          releaseStage = resolve;
        });
        yield cancelSignalled
          ? { kind: "cancelled", runId: command.runId, timestamp: "t" }
          : { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
    return { runner, calls, release: () => releaseStage?.() };
  }

  it("cuts a stage that outlives the stage ceiling, and asks the runner to cancel", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", timeout: { maxStageSeconds: 1 } });
    mockStatus(false);

    const { runner, calls } = hangingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) events.push(event);

    // Asserted against the runner, not by the absence of an error: the
    // ceiling has to reach the process, not merely end the generator.
    expect(calls.some((c) => c.kind === "cancel")).toBe(true);
    const cancelled = events.find((e) => e.kind === "cancelled");
    expect(cancelled).toBeDefined();
    expect((cancelled as { reason?: string }).reason).toContain("maxStageSeconds is 1s");
  });

  it("names the run ceiling rather than the stage when the run ceiling is what was reached", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      timeout: { maxRunSeconds: 1, maxStageSeconds: 1 },
    });
    mockStatus(false);

    const { runner } = hangingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    const cancelled = events.find((e) => e.kind === "cancelled");
    expect((cancelled as { reason?: string }).reason).toContain("maxRunSeconds is 1s");
  });

  it("is cancelled, never failed — a ceiling doing its job is not a defect", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", timeout: { maxStageSeconds: 1 } });
    mockStatus(false);

    const { runner } = hangingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.some((e) => e.kind === "cancelled")).toBe(true);
    expect(events.some((e) => e.kind === "failed")).toBe(false);
  });

  it("carries no reason when a person cancels, which is what an absent reason has always meant", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner, release } = hangingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();
    await waitForChain(
      () => expect(events.some((e) => e.kind === "started" && e.timestamp === "t")).toBe(true),
      "the stage run to emit started",
    );
    chain.cancel(command.runId);
    release();
    await pump;

    const cancelled = events.find((e) => e.kind === "cancelled");
    expect(cancelled).toBeDefined();
    expect((cancelled as { reason?: string }).reason).toBeUndefined();
  });

  it("does not count time spent waiting at a checkpoint against the run ceiling", async () => {
    // The property most likely to regress silently: if the clock ran
    // here, the ceiling would fire on chains behaving exactly as
    // semi-autonomous intends, punishing a person for deliberating.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      timeout: { maxRunSeconds: 2 },
    });
    mockStatus(false);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();

    await waitForChain(
      () => expect(events.some((e) => e.kind === "checkpoint")).toBe(true),
      "the checkpoint the chain waits at",
    );
    // Longer than the whole run ceiling. A chain that counted this would
    // refuse to continue below.
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    chain.confirmCheckpoint(command.runId);

    await waitForChain(
      () => expect(events.filter((e) => e.kind === "stageStarted").length).toBeGreaterThan(1),
      "the stage after the checkpoint, which a counted wait would have prevented",
    );

    chain.cancel(command.runId);
    await pump;

    // Reached a second stage, so the wait was not charged to the ceiling.
    expect(events.filter((e) => e.kind === "stageStarted").length).toBeGreaterThan(1);
  });

  it("attempts a cut stage again while attempts remain, saying which attempt and why the last ended", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      timeout: { maxStageSeconds: 1 },
      maxStageAttempts: 2,
    });
    mockStatus(false);

    const { runner } = hangingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    const starts = events.filter((e) => e.kind === "stageStarted");
    const retry = starts.find((e) => (e as { attempt?: number }).attempt === 2);
    expect(retry).toBeDefined();
    expect((retry as { previousAttemptReason?: string }).previousAttemptReason).toContain("maxStageSeconds is 1s");

    // Exhausted, so the chain stops naming the stage and the ceiling
    // rather than walking on to a stage whose prerequisites were not met.
    const cancelled = events.filter((e) => e.kind === "cancelled").at(-1);
    expect((cancelled as { reason?: string }).reason).toContain("maxStageAttempts: 2");
  });

  it("attempts a stage once when no attempt count is configured", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", timeout: { maxStageSeconds: 1 } });
    mockStatus(false);

    const { runner } = hangingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.filter((e) => e.kind === "stageStarted")).toHaveLength(1);
  });

  it("does not attempt a stage again when it failed on its own merits", async () => {
    // Retrying a stage that failed would only repeat the failure; the
    // attempt count exists for a stage that was cut, not one that ended.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", maxStageAttempts: 3 });
    mockStatus(false);

    const runner: AgentRunner = {
      async *run(command) {
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        yield { kind: "failed", runId: command.runId, timestamp: "t", reason: "the agent refused" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.filter((e) => e.kind === "stageStarted")).toHaveLength(1);
  });

  it("leaves a chain with no ceiling configured exactly as it was", async () => {
    // The regression that matters most: every configuration written
    // before these fields existed means unbounded, and must stay so.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();
    await waitForChain(
      () => expect(events.some((e) => e.kind === "checkpoint")).toBe(true),
      "the first checkpoint, reached with no ceiling in force",
    );
    chain.cancel(command.runId);
    await pump;

    expect(events.some((e) => e.kind === "cancelled")).toBe(true);
    expect(events.filter((e) => e.kind === "cancelled").every((e) => (e as { reason?: string }).reason === undefined)).toBe(true);
  });
});

describe("HarnessChainRunner — cancellation mid-stage", () => {
  it("mirrors the single-stage cancel convention and ends the chain once the stage's own run ends", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    let releaseStage: (() => void) | undefined;
    const calls: Command[] = [];
    let cancelSignalled = false;
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        if (command.kind === "cancel") {
          cancelSignalled = true;
          return;
        }
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        await new Promise<void>((resolve) => {
          releaseStage = resolve;
        });
        yield cancelSignalled
          ? { kind: "cancelled", runId: command.runId, timestamp: "t" }
          : { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();

    await waitForChain(
      () => expect(events.some((e) => e.kind === "started" && e.timestamp === "t")).toBe(true),
      "the stage run to emit started",
    );
    expect(chain.cancel(command.runId)).toBe(true);
    await waitForChain(
      () => expect(cancelSignalled).toBe(true),
      "the runner to observe the forwarded cancel command",
    );
    releaseStage?.();
    await pump;

    expect(events.at(-1)).toMatchObject({ kind: "cancelled" });
    expect(calls.map((c) => c.kind)).toEqual(["plan", "cancel"]);
  });
});

describe("HarnessChainRunner — permission resolution mid-stage", () => {
  it("forwards a resolvePermission command to the stage's own runner, unchanged", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    let releaseStage: (() => void) | undefined;
    const calls: Command[] = [];
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        if (command.kind === "resolvePermission") return;
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        await new Promise<void>((resolve) => {
          releaseStage = resolve;
        });
        yield { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();

    await waitForChain(
      () => expect(events.some((e) => e.kind === "started" && e.timestamp === "t")).toBe(true),
      "the stage run to emit started",
    );

    const answer: Command = {
      ...command,
      kind: "resolvePermission",
      permissionRequestId: "req-1",
      permissionOutcome: "allow",
    };
    expect(chain.resolvePermission(answer)).toBe(true);
    await waitForChain(
      () => expect(calls.some((c) => c.kind === "resolvePermission")).toBe(true),
      "the runner to observe the forwarded resolvePermission command",
    );
    // Asserted against the runner's own record of what it received, not by
    // the absence of a failed event — the command must reach the runner
    // byte-identical, so the driver's `runId:requestId` key still matches.
    expect(calls.at(-1)).toEqual(answer);

    // Ends the chain rather than letting it run on into the next stage's
    // checkpoint (which nothing in this test would ever confirm) — the
    // point already proven is that the answer reached the runner unchanged.
    releaseStage?.();
    chain.cancel(command.runId);
    await pump;
  });

  it("is a no-op, not a failed event, when the chain has no stage currently in flight", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();

    await waitForChain(
      () => expect(events.some((e) => e.kind === "checkpoint")).toBe(true),
      "the checkpoint between stages, where no stage is currently running",
    );

    expect(
      chain.resolvePermission({
        ...command,
        kind: "resolvePermission",
        permissionRequestId: "req-1",
        permissionOutcome: "allow",
      }),
    ).toBe(true);
    expect(events.some((e) => e.kind === "failed")).toBe(false);

    chain.cancel(command.runId);
    await pump;
  });

  it("returns false for a runId naming no active chain, so a host falls through to its own single-stage path", () => {
    const chain = new HarnessChainRunner({ resolveRunner: () => undefined });
    expect(
      chain.resolvePermission({
        kind: "resolvePermission",
        cwd: "/x",
        runId: "no-such-run",
        context: { changeDir: "/x/openspec/changes/demo" },
        permissionRequestId: "req-1",
        permissionOutcome: "allow",
      }),
    ).toBe(false);
  });

  it("carries a permissionRequest event through with the pair a fake driver then resolves against", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    // Mirrors AcpSessionDriver's own `${runId}:${requestId}` pending-request
    // key (acp-session-driver.ts's `resolvePermission`) rather than
    // asserting the event's shape in isolation — the test fails if the pair
    // the chain's stream carries ever stops being the pair this "driver"
    // can look up.
    const pending = new Map<string, () => void>();
    const runner: AgentRunner = {
      async *run(command) {
        if (command.kind === "resolvePermission") {
          const key = `${command.runId}:${command.permissionRequestId}`;
          pending.get(key)?.();
          return;
        }
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        // The pending entry is registered BEFORE the `permissionRequest`
        // event is yielded — matching `AcpSessionDriver`'s real shape,
        // where the pending map entry is set by the ACP request handler
        // itself, not by anything downstream of the generator's own
        // suspension. Registering it after the yield would let a consumer
        // that reacts synchronously (as `runStage`'s interception does)
        // resolve a key that does not exist yet.
        const resolved = new Promise<void>((resolve) => {
          pending.set(`${command.runId}:req-1`, resolve);
        });
        yield { kind: "permissionRequest", runId: command.runId, timestamp: "t", requestId: "req-1", description: "run rm -rf" };
        await resolved;
        yield { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();

    await waitForChain(
      () => expect(events.some((e) => e.kind === "permissionRequest")).toBe(true),
      "the stage's permissionRequest to reach the chain's stream",
    );
    const request = events.find((e) => e.kind === "permissionRequest") as Extract<Event, { kind: "permissionRequest" }>;
    // The stage runs under the chain's own runId (design.md's correction to
    // the proposal) — the id a surface must answer with is this event's,
    // not `command.runId` re-derived some other way.
    expect(request.runId).toBe(command.runId);

    expect(
      chain.resolvePermission({
        ...command,
        kind: "resolvePermission",
        runId: request.runId,
        permissionRequestId: request.requestId,
        permissionOutcome: "allow",
      }),
    ).toBe(true);

    // Ends the chain rather than letting it run on into the next stage's
    // checkpoint — the point already proven is that the (runId, requestId)
    // pair the chain's stream carried is the pair the driver resolved
    // against.
    chain.cancel(command.runId);
    await pump;
  });
});

describe("HarnessChainRunner — autonomous permission requests", () => {
  it("fails the stage naming the request, ends the process, and does not answer on the operator's behalf", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(false);

    let releaseStage: (() => void) | undefined;
    let cancelSignalled = false;
    const calls: Command[] = [];
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        if (command.kind === "cancel") {
          cancelSignalled = true;
          releaseStage?.();
          return;
        }
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        // Registered BEFORE the `permissionRequest` event is yielded — see
        // the identical note in the "carries a permissionRequest event"
        // test above. `runStage`'s interception reacts to this event and
        // sends the `"cancel"` command synchronously (within the same
        // consumer turn), before this generator would otherwise get a
        // chance to resume past its own yield.
        const released = new Promise<void>((resolve) => {
          releaseStage = resolve;
        });
        yield { kind: "permissionRequest", runId: command.runId, timestamp: "t", requestId: "req-1", description: "run rm -rf /tmp/x" };
        await released;
        yield { kind: "cancelled", runId: command.runId, timestamp: "t" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) events.push(event);

    expect(events.filter((e) => e.kind === "permissionRequest")).toHaveLength(1);
    const failed = events.find((e) => e.kind === "failed") as Extract<Event, { kind: "failed" }> | undefined;
    expect(failed?.reason).toContain('autonomyLevel "autonomous"');
    expect(failed?.reason).toContain("run rm -rf /tmp/x");
    // The stage's own terminal event (cancelled, produced by ending its
    // process) must not surface on top of the chain's own failed outcome.
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect(events.some((e) => e.kind === "cancelled")).toBe(false);
    expect(cancelSignalled).toBe(true);
    expect(calls.map((c) => c.kind)).toEqual(["plan", "cancel"]);
  });
});

describe("HarnessChainRunner — misuse", () => {
  it("fails immediately for a non-chain command", async () => {
    const chain = new HarnessChainRunner({ resolveRunner: () => undefined });
    const events: Event[] = [];
    for await (const event of chain.run({ kind: "implement", cwd: "/x", runId: "r", context: { changeDir: "/x/openspec/changes/demo" } })) {
      events.push(event);
    }
    expect(events).toEqual([expect.objectContaining({ kind: "failed" })]);
  });

  it("confirmCheckpoint/cancel return false for an unknown runId", () => {
    const chain = new HarnessChainRunner({ resolveRunner: () => undefined });
    expect(chain.confirmCheckpoint("no-such-run")).toBe(false);
    expect(chain.cancel("no-such-run")).toBe(false);
  });
});

describe("HarnessChainRunner — asAgentRunner", () => {
  it("runs a chain command exactly like run() does", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const adapter = chain.asAgentRunner();

    const events: Event[] = [];
    for await (const event of adapter.run(baseCommand(root))) {
      events.push(event);
      if (event.kind === "checkpoint") chain.cancel(baseCommand(root).runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "cancelled" });
  });

  it("routes a cancel command to cancel() instead of rejecting it as non-chain", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const adapter = chain.asAgentRunner();
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of adapter.run(command)) events.push(event);
    })();

    await waitForChain(
      () => expect(events.some((e) => e.kind === "checkpoint")).toBe(true),
      "the checkpoint before adapter-level cancel",
    );

    // A "cancel" sent through the adapter (mirroring how RunController
    // re-sends one to "the active runner") must resolve the pending
    // checkpoint via cancel(), not be rejected the way a bare
    // HarnessChainRunner.run({kind:"cancel"}) call would be.
    const cancelEvents: Event[] = [];
    for await (const event of adapter.run({ ...command, kind: "cancel" })) cancelEvents.push(event);
    // Acknowledges the request without claiming the chain has ended — the
    // chain's own stream says `cancelled` below, after the stage's run
    // actually returns. Returning nothing here left the panel with no
    // sign the click had landed.
    expect(cancelEvents).toEqual([
      expect.objectContaining({ kind: "cancelling", attempted: "termination-requested" }),
    ]);

    await pump;
    expect(events.at(-1)).toMatchObject({ kind: "cancelled" });
  });

  it("routes a resolvePermission command to the stage's own runner, unchanged, and yields nothing", async () => {
    // Task 5.1. The `resolvePermission` branch in `asAgentRunner` was
    // reached only through `chain.resolvePermission(command)` in the
    // permission-resolution tests above; nothing drove it through the
    // adapter, which is the path a panel actually uses. Both halves of
    // the branch are asserted here: what it forwards, and that it yields
    // nothing.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    let releaseStage: (() => void) | undefined;
    const calls: Command[] = [];
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        if (command.kind === "resolvePermission") return;
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        await new Promise<void>((resolve) => {
          releaseStage = resolve;
        });
        yield { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const adapter = chain.asAgentRunner();
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of adapter.run(command)) events.push(event);
    })();

    await waitForChain(
      () => expect(events.some((e) => e.kind === "started" && e.timestamp === "t")).toBe(true),
      "the stage run to emit started",
    );

    const answer: Command = {
      ...command,
      kind: "resolvePermission",
      permissionRequestId: "req-1",
      permissionOutcome: "allow",
    };
    const answerEvents: Event[] = [];
    for await (const event of adapter.run(answer)) answerEvents.push(event);

    // The empty stream is the assertion, not an incidental detail. Without
    // this branch the command would fall through to run(), which accepts
    // only "chain" commands and answers anything else with a failed event
    // — the failure this change exists to remove. Asserting the stream is
    // empty is how that stays removed; asserting no error was thrown
    // would pass just as well if the branch were deleted and the command
    // silently dropped, which is why the runner is checked too.
    expect(answerEvents).toEqual([]);

    await waitForChain(
      () => expect(calls.some((c) => c.kind === "resolvePermission")).toBe(true),
      "the runner to observe the command forwarded through the adapter",
    );
    // Byte-identical, for the same reason the direct-call test gives: the
    // driver keys a pending request by `runId:requestId`, so a command
    // the chain rewrote on the way through would resolve nothing.
    expect(calls.at(-1)).toEqual(answer);

    releaseStage?.();
    chain.cancel(command.runId);
    await pump;
  });
});

describe("HarnessChainRunner — budget (task 8.7)", () => {
  it("stops before the next stage when recorded usage reaches the ceiling, and reports the budget reason", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli" },
      budget: { maxCostUsd: 1 },
    });
    mockStatus(false); // propose not done yet -> chain starts at "propose"

    const command = baseCommand(root);
    let calls = 0;
    const listAuditEntries = vi.fn(() => {
      calls += 1;
      // Nothing recorded before "propose" starts; by the time "review"
      // is about to start, "propose"'s own run has been recorded with
      // usage over the ceiling.
      if (calls === 1) return [];
      return [
        {
          runId: "propose-run",
          agent: "claude-cli",
          outcome: "completed" as const,
          cwd: root,
          timestamp: "t",
          changeDir: command.context.changeDir,
          usage: { costUsd: 5 },
        },
      ];
    });

    const { runner, calls: runnerCalls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, listAuditEntries });

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    // Only "propose" (mapped to "plan") ran — "review" never started.
    expect(runnerCalls.map((c) => c.kind)).toEqual(["plan"]);
    expect(events.at(-1)).toMatchObject({ kind: "failed", reason: expect.stringContaining("budget") });
    expect(events.some((e) => e.kind === "completed")).toBe(false);
  });

  it("a chain with no ceiling behaves identically to today, even with high recorded usage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli" },
    });
    mockStatus(false);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const command = baseCommand(root);
    const listAuditEntries = vi.fn(() => [
      {
        runId: "propose-run",
        agent: "claude-cli",
        outcome: "completed" as const,
        cwd: root,
        timestamp: "t",
        changeDir: command.context.changeDir,
        usage: { costUsd: 999 },
      },
    ]);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, listAuditEntries });

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("a chain whose runs report no usage runs to completion despite a configured ceiling", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli" },
      budget: { maxCostUsd: 1 },
    });
    mockStatus(false);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const command = baseCommand(root);
    const listAuditEntries = vi.fn(() => [
      {
        runId: "propose-run",
        agent: "claude-cli",
        outcome: "completed" as const,
        cwd: root,
        timestamp: "t",
        changeDir: command.context.changeDir,
        // No `usage` — unmeasured, must not count against the ceiling.
      },
    ]);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, listAuditEntries });

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });
});

describe("HarnessChainRunner — stageStarted (usage-visible-while-running)", () => {
  it("announces every stage that runs, in order, with the agent that will run it", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli-acp", verify: "claude-cli" },
    });
    mockStatus(false);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    const started = events.filter((event) => event.kind === "stageStarted") as (Event & {
      stage: string;
      agentId: string;
    })[];
    expect(started.map((event) => event.stage)).toEqual(["propose", "review", "apply", "verify", "archive"]);
    // The agent that will actually run it, per stage — and "" for
    // "archive", which runs no agent at all.
    expect(started.map((event) => event.agentId)).toEqual([
      "claude-cli",
      "claude-cli",
      "claude-cli-acp",
      "claude-cli",
      "",
    ]);
    // Announced before the stage does anything, so a surface can
    // attribute the FIRST stage's output to it — the case no
    // stageCompleted could ever cover.
    expect(events[0]).toMatchObject({ kind: "started" });
    expect(events.findIndex((event) => event.kind === "stageStarted")).toBeLessThan(
      events.findIndex((event) => event.kind === "checkpoint"),
    );
  });

  it("does not announce a stage refused at the budget ceiling", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli" },
      budget: { maxCostUsd: 1 },
    });
    mockStatus(false);

    const command = baseCommand(root);
    let calls = 0;
    const listAuditEntries = vi.fn(() => {
      calls += 1;
      if (calls === 1) return [];
      return [
        {
          runId: "propose-run",
          agent: "claude-cli",
          outcome: "completed" as const,
          cwd: root,
          timestamp: "t",
          changeDir: command.context.changeDir,
          usage: { costUsd: 5 },
        },
      ];
    });

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, listAuditEntries });

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    // "propose" ran and was announced; "review" was refused before it
    // started, so announcing it would name a stage that spent nothing.
    const started = events.filter((event) => event.kind === "stageStarted") as (Event & { stage: string })[];
    expect(started.map((event) => event.stage)).toEqual(["propose"]);
    expect(events.at(-1)).toMatchObject({ kind: "failed", reason: expect.stringContaining("budget") });
  });
});

describe("HarnessChainRunner — a real run's reported usage stops the chain (usage-from-acp task 4.4)", () => {
  it("stops at the next stage boundary on usage an adapter reported, recorded by the real runner", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli-acp", review: "claude-cli-acp", apply: "claude-cli-acp" },
      budget: { maxCostUsd: 1 },
    });
    mockStatus(false); // propose not done yet -> the chain starts at "propose"

    // The whole path this change exists to close, with nothing hand-written
    // in the middle: an adapter reports usage -> the real `createAgentRunner`
    // writes it into its own audit entry -> `buildUsageReport` sums it ->
    // the chain refuses to start the next stage. The other budget tests
    // above fabricate the audit entry, so they pass whether or not any
    // adapter can ever produce one.
    const adapter: AgentAdapter = {
      name: "claude-cli-acp",
      buildInvocation: () => ({ kind: "process", executable: "usage-cli", args: ["-p"] }),
      async *execute(invocation, command) {
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        yield {
          kind: "usageReported",
          runId: command.runId,
          timestamp: "t",
          usage: { inputTokens: 900, outputTokens: 120, costUsd: 5 },
        };
        yield { kind: "completed", runId: command.runId, timestamp: "t", summary: `${command.kind} done` };
      },
    };
    const allowlist: AllowlistConfig = { "claude-cli-acp": [{ executable: "usage-cli", argsAllowed: () => true }] };
    const auditLog = new InMemoryAuditLog();
    const runner = createAgentRunner(adapter, { workspaceRoot: root, allowlist, auditLog });

    const command = baseCommand(root);
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      listAuditEntries: () => auditLog.entries,
    });

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    // The first stage ran and reported; the second never started.
    expect(auditLog.entries.some((entry) => entry.outcome === "completed" && entry.usage?.costUsd === 5)).toBe(true);
    expect(events.at(-1)).toMatchObject({ kind: "failed", reason: expect.stringContaining("budget") });
    expect(events.some((event) => event.kind === "completed" && event.summary === "review done")).toBe(false);
  });
});

describe("HarnessChainRunner — budget from persisted audit history (task 4.3, audit-log-persistence)", () => {
  it("counts entries recorded by a FileAuditLog before this process's own listAuditEntries reader was constructed", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli" },
      budget: { maxCostUsd: 1 },
    });
    mockStatus(false); // propose not done yet -> chain starts at "propose"

    const command = baseCommand(root);

    // Simulates a run recorded by an EARLIER process (e.g. before a host
    // restart) — a separate `FileAuditLog` instance, written and flushed
    // to `.openspec-ui/audit.jsonl` before this test's own chain ever
    // starts, standing in for "yesterday's process, already exited".
    const priorProcessAuditLog = new FileAuditLog(auditLogPath(root));
    priorProcessAuditLog.record({
      runId: "prior-process-run",
      agent: "claude-cli",
      outcome: "completed",
      cwd: root,
      timestamp: "t0",
      changeDir: command.context.changeDir,
      usage: { costUsd: 5 },
    });
    await waitForChain(async () => {
      expect(await priorProcessAuditLog.readEntries()).toHaveLength(1);
    }, "the persisted audit entry to be readable from disk");

    // This process's own reader — a fresh `FileAuditLog` instance over the
    // same file, exactly as `server.ts`/`extension.ts` construct one on
    // startup with no in-memory knowledge of the run recorded above.
    const currentProcessAuditLog = new FileAuditLog(auditLogPath(root));
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      listAuditEntries: () => currentProcessAuditLog.readEntries(),
    });

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    // The budget was already exceeded by the prior process's recorded
    // spend, so "propose" never even starts — proving the reader picked up
    // history from disk, not from anything held in this process's memory.
    expect(events.at(-1)).toMatchObject({ kind: "failed", reason: expect.stringContaining("budget") });
    expect(events.some((e) => e.kind === "completed")).toBe(false);
  });
});

describe("HarnessChainRunner — stepAgents effort and budget reach the stage Command (harness-step-effort-and-budget)", () => {
  it("threads a stage's resolved effort and budget into the Command handed to the runner", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: {
        apply: { agent: "claude-cli", model: "claude-haiku-4-5", effort: "high", budget: { maxCostUsd: 5 } },
      },
    });
    mockStatus(true); // artifacts already done, tasks unchecked -> chain starts at "apply"
    await writeTasks(root, 3, 0);

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    const applyCall = calls.find((c) => c.kind === "implement");
    expect(applyCall).toMatchObject({
      agentId: "claude-cli",
      model: "claude-haiku-4-5",
      effort: "high",
      budget: { maxCostUsd: 5 },
    });
  });

  it("leaves effort and budget undefined for a stage whose stepAgents entry sets neither", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli" },
    });
    mockStatus(true);
    await writeTasks(root, 3, 0);

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    const applyCall = calls.find((c) => c.kind === "implement");
    expect(applyCall?.effort).toBeUndefined();
    expect(applyCall?.budget).toBeUndefined();
  });
});

describe("CHAIN_STAGE_COMMAND / HarnessStepAgentStage consistency (harness-git-stage-no-agent 5.4)", () => {
  it("excludes from HarnessStepAgentStage every CHAIN_STAGES entry that has no CHAIN_STAGE_COMMAND", async () => {
    // This is the assertion that would have caught the original miss:
    // `git` was added to CHAIN_STAGES without a CHAIN_STAGE_COMMAND entry,
    // and to HarnessStage, in the same pull request that left it out of
    // HarnessStepAgentStage's exclusion list. Reads the real, exported
    // consts rather than a hand-copied list, so the next stage added the
    // same way fails this test instead of slipping through silently.
    const { CHAIN_STAGES, CHAIN_STAGE_COMMAND } = await import("./harness-chain-runner.js");
    const { isHarnessStepAgentStage } = await import("./harness-config.js");

    const stagesWithoutCommand = CHAIN_STAGES.filter((stage) => !(stage in CHAIN_STAGE_COMMAND));
    expect(stagesWithoutCommand.length).toBeGreaterThan(0);
    for (const stage of stagesWithoutCommand) {
      expect(isHarnessStepAgentStage(stage)).toBe(false);
    }
  });
});

describe("HarnessChainRunner — a failed check sends work back (verify-sends-work-back section 6)", () => {
  // The gate that runs `verify`'s checks used to return "failed" before
  // the loop reached the backward edge, so the edge could never fire for
  // the case its own comment names: a failing check is what unchecks the
  // task. Found live on 2026-09-08, running a chain whose `apply` edited
  // a file a declared check then reported.

  it("returns to apply when a check fails and an attempt is left, without invoking the verifying agent", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli", verify: "claude-cli" },
      maxStageAttempts: 2,
    });
    mockStatus(true);
    await setupChangeset(root, false); // the check fails
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    // Two "implement" calls and no "verify" call: the work went back to
    // apply, and the gate's whole reason for existing — not spending a
    // verifying run on something a check already found broken — is kept.
    expect(calls.map((c) => c.kind)).toEqual(["implement", "implement"]);
    const returned = events.find(
      (event) => event.kind === "stageStarted" && (event as { previousAttemptReason?: string }).previousAttemptReason !== undefined,
    ) as { stage: string; previousAttemptReason: string } | undefined;
    expect(returned?.stage).toBe("apply");
    expect(returned?.previousAttemptReason).toContain("changeset-present");
  });

  it("fails with the message it always had when no attempt is left", async () => {
    // Nothing configured is one attempt, so every configuration that
    // existed before the return keeps its exact behaviour.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli", verify: "claude-cli" },
    });
    mockStatus(true);
    await setupChangeset(root, false);
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(calls.map((c) => c.kind)).toEqual(["implement"]);
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as { reason: string }).reason)
      .toContain("mechanical checks failed, verifying agent was not invoked: changeset-present");
  });

  it("reaches archive when the second apply satisfies the check", async () => {
    // The point of a return is that the chain finishes the work rather
    // than reporting it.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli", verify: "claude-cli" },
      maxStageAttempts: 2,
    });
    mockStatus(true);
    await setupChangeset(root, false);
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));

    const calls: Command[] = [];
    let applyCount = 0;
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        if (command.kind === "cancel") return;
        // The second "apply" does what the check asks for, which is the
        // whole scenario: work came back, and this time it was finished.
        if (command.kind === "implement" && ++applyCount === 2) await setupChangeset(root, true);
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        yield { kind: "completed", runId: command.runId, timestamp: "t", summary: `${command.kind} done` };
      },
    };
    mockArchiveSucceeds();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(calls.map((c) => c.kind)).toEqual(["implement", "implement", "verify"]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("stops after the configured attempts rather than looping on a check that keeps failing", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli", verify: "claude-cli" },
      maxStageAttempts: 2,
    });
    mockStatus(true);
    await setupChangeset(root, false); // never satisfied
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    // Bounded by the attempt count, not by anything about the check.
    expect(calls.filter((c) => c.kind === "implement")).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
  });
});

/** Consumes `iterator` until `predicate` matches, invoking `onMatch`
 * synchronously right after the matching event (before resuming
 * iteration) — used to fire `cancel()`/`confirmCheckpoint()` at exactly
 * the moment a checkpoint is observed, then drains the rest. */
async function collectUntilThenAct(
  iterator: AsyncGenerator<Event>,
  predicate: (event: Event) => boolean,
  onMatch: () => void,
): Promise<{ events: Event[] }> {
  const events: Event[] = [];
  for await (const event of iterator) {
    events.push(event);
    if (predicate(event)) {
      onMatch();
    }
  }
  return { events };
}

describe("HarnessChainRunner — verify records what its checks found", () => {
  // verify-records-what-it-found. The counts were computed to decide
  // whether to invoke the verifying agent, and then discarded — and the
  // failing case, which never invokes the agent, wrote no entry at all.

  it("records how many checks ran, that none failed, and whose work was checked", async () => {
    const root = await temporaryRoot();
    // The apply agent is deliberately not the verify agent: with both
    // set to the same id, an assertion on `checkedAgent` passes whether
    // the runner reads the apply stage or any other.
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "codex-cli", verify: "claude-cli" },
    });
    mockStatus(true);
    await setupChangeset(root, true);
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));
    mockArchiveSucceeds();

    const auditLog = new InMemoryAuditLog();
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, auditLog });
    const command = baseCommand(root);
    for await (const event of chain.run(command)) {
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    const recorded = auditLog.entries.filter((entry) => entry.agent === "verify-checks");
    expect(recorded).toHaveLength(1);
    // Fields, not prose: a number in a sentence is a number nothing can
    // aggregate.
    expect(recorded[0]).toMatchObject({ outcome: "completed", checksRan: 1, checksFailed: 0, stage: "verify" });
    // quality-is-charged-to-the-agent-whose-work-was-checked. Asserted
    // over what a chain run actually recorded, because the reader's own
    // tests were hand-built entries of a shape the runner never wrote,
    // and they passed for it.
    expect(recorded[0]?.checkedAgent).toBe("codex-cli");
    // The writer stays in `agent`: the audit log records who wrote the
    // entry, and this one was written by no agent at all.
    expect(recorded[0]?.agent).toBe("verify-checks");
  });

  it("names the default agent as checked when no apply agent is configured", async () => {
    // `resolveRunner` falls back to DEFAULT_AGENT_ID for an unset stage,
    // so that is the agent the apply run's own entries carry — and the
    // two have to group together.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", stepAgents: { verify: "claude-cli" } });
    mockStatus(true);
    await setupChangeset(root, true);
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));
    mockArchiveSucceeds();

    const auditLog = new InMemoryAuditLog();
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, auditLog });
    const command = baseCommand(root);
    for await (const event of chain.run(command)) {
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(auditLog.entries.find((entry) => entry.agent === "verify-checks")?.checkedAgent).toBe(DEFAULT_AGENT_ID);
  });

  it("records a failing check even though the verifying agent never runs", async () => {
    // This is the case that recorded nothing at all: the entry was
    // written by an agent run that does not happen, so the run that
    // found the most left no trace.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli", verify: "claude-cli" },
    });
    mockStatus(true);
    await setupChangeset(root, false);
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));

    const auditLog = new InMemoryAuditLog();
    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, auditLog });
    const command = baseCommand(root);
    for await (const event of chain.run(command)) {
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(calls.map((call) => call.kind)).toEqual(["implement"]);
    const recorded = auditLog.entries.filter((entry) => entry.agent === "verify-checks");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ outcome: "failed", checksRan: 1, checksFailed: 1 });
    expect(recorded[0]?.reason).toContain("changeset-present");
  });

  it("records nothing for a change that declares no checks", async () => {
    // An entry saying none ran is indistinguishable from one saying none
    // failed.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli", verify: "claude-cli" },
    });
    mockStatus(true);
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 nothing declared here.", ""].join("\n"));
    mockArchiveSucceeds();

    const auditLog = new InMemoryAuditLog();
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, auditLog });
    const command = baseCommand(root);
    for await (const event of chain.run(command)) {
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(auditLog.entries.filter((entry) => entry.agent === "verify-checks")).toEqual([]);
  });
});

describe("HarnessChainRunner — a checks entry is not a previous run", () => {
  // quality-is-charged-to-the-agent-whose-work-was-checked. The checks
  // entry has a terminal outcome and no `started` partner, so
  // `buildChangeCostReport` listed it as "a run refused before it
  // started" and the recommendation's grounds read "2 previous runs"
  // after one apply. Asserted over a chain run whose audit entries the
  // real `createAgentRunner` wrote, so the shape is the product's.

  it("counts one previous run after an apply and a verify whose checks failed", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli", verify: "claude-cli" },
    });
    mockStatus(true);
    // The changeset is missing, so the declared check fails and the
    // verifying agent is never invoked — exactly one agent run happened,
    // beside one checks entry.
    await setupChangeset(root, false);
    await writeTasksRaw(root, ["## 1. Tasks", "", "- [ ] 1.1 has a changeset. `check(changeset-present)`", ""].join("\n"));

    const adapter: AgentAdapter = {
      name: "claude-cli",
      buildInvocation: () => ({ kind: "process", executable: "claude", args: ["-p"] }),
      async *execute(_invocation, command) {
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        yield { kind: "completed", runId: command.runId, timestamp: "t", summary: `${command.kind} done` };
      },
    };
    const allowlist: AllowlistConfig = { "claude-cli": [{ executable: "claude", argsAllowed: () => true }] };
    const auditLog = new InMemoryAuditLog();
    const runner = createAgentRunner(adapter, { workspaceRoot: root, allowlist, auditLog });
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, auditLog });
    const command = baseCommand(root);
    for await (const event of chain.run(command)) {
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    const changeDir = path.join(root, "openspec", "changes", "demo");
    expect(auditLog.entries.filter((entry) => entry.checksRan !== undefined)).toHaveLength(1);

    const report = buildChangeCostReport(auditLog.entries, changeDir);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ stage: "apply", agent: "claude-cli" });

    const grounds = recommendTemplate({ openTaskCount: 1, history: report }).grounds;
    expect(grounds).toContain("1 previous run");
    expect(grounds).not.toContain("2 previous runs");

    // And the same entry is excluded from the workspace-wide figures,
    // by the same predicate rather than by a second copy of the rule.
    const known = { active: ["demo"], archived: [] };
    expect(buildWorkspaceRunStats(auditLog.entries, known).runs).toBe(1);
  });
});

describe("HarnessChainRunner — a change with no design", () => {
  // design-is-optional-for-resume. A change may deliberately carry no
  // design; the validator accepts one that does not, and three of this
  // repository's own active changes have none. Requiring it sent a
  // finished change back to `propose`.

  it("resumes at verify when every task is checked, rather than re-proposing", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatusWithoutDesign();
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    // Not "propose": the work is written, and re-proposing it spends a
    // run and points an agent at a finished proposal.
    expect(calls.map((c) => c.kind)).toEqual(["verify"]);
  });

  it("resumes at apply when tasks are still unchecked", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatusWithoutDesign();
    await writeTasks(root, 2, 1);

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(calls[0]?.kind).toBe("implement");
  });

  it("still starts at propose when the proposal itself is not written", async () => {
    // The case the check exists for: `ready` is not `done`, and an
    // unwritten proposal must not look finished.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(calls[0]?.kind).toBe("plan");
  });
});

describe("HarnessChainRunner — declared steps (a-change-can-declare-a-step)", () => {
  /** A workspace whose `demo` change declares `steps`, ready to run a
   * chain with no confirmations. `theirs` is the change a wait names;
   * `landTheirs` leaves it absent, which is what "already landed" looks
   * like to the step. */
  async function workspaceWithDeclaredStep(
    steps: Array<Record<string, unknown>>,
    options: { landTheirs?: boolean } = {},
  ): Promise<string> {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", {
      checkpoints: { requireConfirmationBetweenSteps: false },
      steps,
    } as never);
    await writeTasks(root, 0, 3);

    if (!options.landTheirs) {
      const theirs = path.join(root, "openspec", "changes", "theirs");
      await mkdir(theirs, { recursive: true });
      await writeFile(path.join(theirs, "proposal.md"), "# Theirs\n\n## Why\n\nBecause.\n", "utf8");
      await writeFile(path.join(theirs, "tasks.md"), "- [ ] 1.1 do it\n", "utf8");
    }
    return root;
  }

  async function collectChain(root: string, runner: AgentRunner): Promise<Event[]> {
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);
    return events;
  }

  function startedParts(events: Event[]): string[] {
    return events.filter((e) => e.kind === "stageStarted").map((e) => (e as unknown as { stage: string }).stage);
  }

  it("runs a declared step at its position, with every fixed stage still in order", async () => {
    const root = await workspaceWithDeclaredStep(
      [{ step: "await-change", before: "verify", param: "theirs" }],
      { landTheirs: true },
    );
    mockStatus(false);
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const events = await collectChain(root, runner);

    expect(startedParts(events)).toEqual(["propose", "review", "apply", "await-change", "verify", "archive"]);
    // The step invoked no agent: the four agent stages ran and nothing else.
    expect(calls.map((c) => c.kind)).toEqual(["plan", "review", "implement", "verify"]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("places a step after the stage it names", async () => {
    const root = await workspaceWithDeclaredStep(
      [{ step: "await-change", after: "apply", param: "theirs" }],
      { landTheirs: true },
    );
    mockStatus(false);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const events = await collectChain(root, runner);

    expect(startedParts(events)).toEqual(["propose", "review", "apply", "await-change", "verify", "archive"]);
  });

  it("reports what the step did, on the chain's own timeline", async () => {
    const root = await workspaceWithDeclaredStep(
      [{ step: "await-change", before: "verify", param: "theirs" }],
      { landTheirs: true },
    );
    mockStatus(false);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const events = await collectChain(root, runner);

    const said = events
      .filter((e) => e.kind === "progress")
      .map((e) => (e as unknown as { message: string }).message);
    expect(said.some((message) => message.startsWith("await-change:") && message.includes("already landed"))).toBe(true);
  });

  it("ends the chain when a step does not succeed, naming the step", async () => {
    const root = await workspaceWithDeclaredStep([
      { step: "await-change", before: "verify", param: "theirs", maxWaitSeconds: 0.1 },
    ]);
    mockStatus(false);

    const { runner, calls } = makeCompletingRunner();
    const events = await collectChain(root, runner);

    const last = events.at(-1) as unknown as { kind: string; reason: string };
    expect(last.kind).toBe("failed");
    expect(last.reason).toContain("await-change");
    expect(last.reason).toContain("theirs");
    // `verify` never ran: a failing step stops the chain as a failing
    // stage does.
    expect(calls.map((c) => c.kind)).toEqual(["plan", "review", "implement"]);
  });

  it("does not run a step anchored to a stage the chain resumed past", async () => {
    // Everything is written and every task is checked, so the chain
    // resumes at `verify`. `apply` is not in the sequence, and a step
    // anchored to it is anchored to work that already happened.
    const root = await workspaceWithDeclaredStep([
      { step: "await-change", after: "apply", param: "theirs", maxWaitSeconds: 0.1 },
    ]);
    mockStatus(true);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const events = await collectChain(root, runner);

    expect(startedParts(events)).toEqual(["verify", "archive"]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("runs a step anchored to the stage the chain resumes at", async () => {
    const root = await workspaceWithDeclaredStep(
      [{ step: "await-change", before: "verify", param: "theirs" }],
      { landTheirs: true },
    );
    mockStatus(true);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const events = await collectChain(root, runner);

    expect(startedParts(events)).toEqual(["await-change", "verify", "archive"]);
  });

  it("a step declared after archive does not let the chain walk into the git stage", async () => {
    // The regression this exists for: the git stage is gated on
    // `reviewGate.mode`, re-derived immediately before `archive` moves
    // the change's file. That gate used to ask whether the very next
    // entry was `git` — and a declared step sitting between them made the
    // answer "no", so the gate never ran and the chain walked into `git`
    // with nothing having decided that it should.
    const root = await workspaceWithDeclaredStep(
      [{ step: "await-change", after: "archive", param: "theirs" }],
      { landTheirs: true },
    );
    mockStatus(true);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const events = await collectChain(root, runner);

    expect(startedParts(events)).not.toContain("git");
  });

  it("a chain whose last part is a step still reports that it finished", async () => {
    // Without a terminal event here the run would look, to every consumer
    // of the stream, like one still going — forever.
    const root = await workspaceWithDeclaredStep(
      [{ step: "await-change", after: "archive", param: "theirs" }],
      { landTheirs: true },
    );
    mockStatus(true);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const events = await collectChain(root, runner);

    expect(startedParts(events)).toEqual(["verify", "archive", "await-change"]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("does not charge a wait against the chain's run-time ceiling", async () => {
    // The ceiling is one second and the wait outlasts it. If waiting
    // counted, this chain would be cancelled at the ceiling — and the
    // configuration behaving exactly as written would be the one that
    // fails.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous", timeout: { maxRunSeconds: 1 } });
    await writeChangeHarnessConfig(root, "demo", {
      checkpoints: { requireConfirmationBetweenSteps: false },
      steps: [{ step: "await-change", before: "verify", param: "theirs", maxWaitSeconds: 10 }],
    } as never);
    await writeTasks(root, 0, 3);
    const theirs = path.join(root, "openspec", "changes", "theirs");
    await mkdir(theirs, { recursive: true });
    await writeFile(path.join(theirs, "proposal.md"), "# Theirs\n", "utf8");
    mockStatus(true);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const events: Event[] = [];
    const run = (async () => {
      for await (const event of chain.run(baseCommand(root))) events.push(event);
    })();

    const archiveDir = path.join(root, "openspec", "changes", "archive");
    setTimeout(() => {
      void (async () => {
        await mkdir(archiveDir, { recursive: true });
        await rename(theirs, path.join(archiveDir, "2026-09-11-theirs"));
      })();
    }, 1_500);
    await run;

    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(events.some((e) => e.kind === "cancelled")).toBe(false);
  });
});

describe("HarnessChainRunner — one repository, one ceiling (changes-run-side-by-side)", () => {
  /** An audit entry pair as a real run records one: a `started` carrying
   * the change directory, and a `completed` carrying the usage. */
  function recordedRun(runId: string, changeDir: string, costUsd: number): AuditEntry[] {
    return [
      {
        timestamp: "2026-09-11T00:00:00.000Z",
        runId,
        agent: "claude-cli",
        outcome: "started",
        changeDir,
      },
      {
        timestamp: "2026-09-11T00:01:00.000Z",
        runId,
        agent: "claude-cli",
        outcome: "completed",
        changeDir,
        usage: { costUsd, inputTokens: 0, outputTokens: 0 },
      },
    ] as unknown as AuditEntry[];
  }

  it("counts what a sibling working directory spent on the same change", async () => {
    // The gap a live pair of parallel runs exposed: `totalsByChange` is
    // keyed by the change directory's ABSOLUTE path, which differs in
    // every worktree. Summing the audit logs across worktrees therefore
    // did nothing on its own — the ceiling was still permitted once per
    // directory.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      budget: { maxCostUsd: 10 },
    });
    await writeChangeHarnessConfig(root, "demo", { checkpoints: { requireConfirmationBetweenSteps: false } });
    mockStatus(false);

    const siblingChangeDir = path.join(root, "..", "repo.worktrees", "demo", "openspec", "changes", "demo");
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      listAuditEntries: () => recordedRun("elsewhere", siblingChangeDir, 12),
    });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as unknown as { reason: string }).reason).toContain("budget exceeded");
  });

  it("does not count a different change that happens to be recorded", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      budget: { maxCostUsd: 10 },
    });
    await writeChangeHarnessConfig(root, "demo", { checkpoints: { requireConfirmationBetweenSteps: false } });
    await writeTasks(root, 0, 3);
    mockStatus(false);
    mockArchiveSucceeds();

    const otherChangeDir = path.join(root, "openspec", "changes", "something-else");
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      listAuditEntries: () => recordedRun("other", otherChangeDir, 99),
    });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    // Matching on the directory's last segment must not turn one
    // change's spending into another's.
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });
});
