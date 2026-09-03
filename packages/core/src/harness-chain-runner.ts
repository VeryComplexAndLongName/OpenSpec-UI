// Chain execution for the Agentic Harness — see
// docs/adr/0012-agentic-harness-chain-execution-protocol.md and
// openspec/changes/agentic-harness-autonomy/design.md. Sequences
// `propose -> review -> apply -> verify -> archive -> git` for a change
// under one `runId`,
// pausing at a `checkpoint` (semi-autonomous, the default) or continuing
// immediately via `stageCompleted` (autonomous, or a per-change
// `checkpoints.requireConfirmationBetweenSteps: false`). The final `git`
// stage is gated by per-change `reviewGate.mode: "agent-sufficient"`.
//
// Lives in `packages/core`, not `webui`/`extension`: which stage is next,
// whether a transition pauses, and whether `autonomous` is actually
// permitted for this change are harness domain decisions, not view logic
// (see design.md, "Chain runner lives in packages/core, not webui" — a
// client-side orchestrator would duplicate this logic across both delivery
// targets and could not outlive a closed webview).

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AdapterInvocation, AgentRunner } from "./agent-runner.js";
import { captureCheckpoint, finalizeCheckpoint, type WorkbenchCheckpoint } from "./checkpoint.js";
import {
  buildGhPrCreateInvocation,
  buildGhPrMergeInvocation,
  buildGitPushInvocation,
  createPullRequestGateway,
  type PullRequestGateway,
} from "./gh-pr-gateway.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import { runMechanicalCheck, type MechanicalCheckContext, type MechanicalCheckResult } from "./mechanical-checks.js";
import type { Command, CommandContext, CommandKind, Event, VerifiedDeltaEntry } from "./protocol.js";
import {
  type HarnessConfig,
  isHarnessStepAgentStage,
  normalizeStepAgent,
  readChangeHarnessConfig,
  resolveHarnessConfig,
} from "./harness-config.js";
import { archiveChange, statusChange } from "./openspec.js";
import { checkAllowlist, type AllowlistConfig, type AuditEntry, type AuditLog } from "./security.js";
import { readTaskChecklist, TASK_CHECKBOX_LINE_RE, writeTaskCheckStates, type TaskCheckDeclaration } from "./task-checklist.js";
import { buildUsageReport } from "./usage-report.js";

/** The subsequence of `HarnessStage` a chain drives. Each entry's
 * `AgentRunner` `CommandKind`, where one exists — `"archive"` and `"git"`
 * have no direct `AgentRunner` command kind: archive is a mechanical
 * `openspec archive` operation, and git is a dedicated push/PR/merge
 * sequence run directly by this runner. Exported (along with
 * `CHAIN_STAGES`) only so a test can assert that every stage missing an
 * entry here stays excluded from `HarnessStepAgentStage` — see
 * harness-git-stage-no-agent tasks.md 5.4: `git` was added here without
 * a `CHAIN_STAGE_COMMAND` entry, and to `HarnessStage`, in the same pull
 * request that forgot to also exclude it from `HarnessStepAgentStage`. */
export const CHAIN_STAGE_COMMAND: Readonly<Record<"propose" | "review" | "apply" | "verify", CommandKind>> = {
  propose: "plan",
  review: "review",
  apply: "implement",
  verify: "verify",
};
export const CHAIN_STAGES = ["propose", "review", "apply", "verify", "archive", "git"] as const;
type ChainStage = (typeof CHAIN_STAGES)[number];
const GIT_STAGE_AGENT_NAME = "git-stage";
const DEFAULT_GIT_REMOTE = "origin";
const DEFAULT_PR_BASE_BRANCH = "main";

export interface HarnessChainDeps {
  /** Resolves the `AgentRunner` for an agent id — same shape each host
   * already injects into its AI panel (e.g.
   * `packages/extension/src/webview/ai-panel.ts`'s `AiPanelDeps.
   * resolveRunner`), typically `default-runners.ts`'s `resolveRunner`
   * curried over that host's `Map<string, AgentRunner>`. Falling back to
   * the default agent for an unset `stepAgents` entry is this function's
   * responsibility, not the chain runner's. */
  resolveRunner: (agentId: string | undefined) => AgentRunner | undefined;
  /** Best-effort accessor for this workspace's recorded audit entries —
   * used only to sum recorded usage against `harnessConfig.budget` before
   * starting each stage (see openspec/changes/agent-usage-accounting/
   * design.md). Absent, or a `harnessConfig` with no `budget` configured,
   * means no budget enforcement — every stage starts exactly as it did
   * before this dependency existed. Kept as its own dependency here
   * rather than as a method on `AuditLog` (security.ts) — that interface
   * stays a pure write sink; this is the one place in this project that
   * needs to read audit history back, so the read-back capability lives
   * with its one caller instead of widening a security-critical
   * interface for it. */
  listAuditEntries?: () => AuditEntry[] | Promise<AuditEntry[]>;
  /** Where git-stage actions are recorded. Optional for compatibility
   * with tests that do not assert audit output. */
  auditLog?: AuditLog;
  /** Override hooks for tests. Production callers use defaults. */
  createGitWrapper?: (options: { cwd: string }) => GitWrapper;
  createPullRequestGateway?: (options: { cwd: string }) => PullRequestGateway;
}

type CheckpointOutcome = "confirmed" | "cancelled";

interface ChainState {
  cancelRequested: boolean;
  pendingCheckpoint?: { resolve: (outcome: CheckpointOutcome) => void };
  currentRunner?: AgentRunner;
  currentCommand?: Command;
}

function nowIso(): string {
  return new Date().toISOString();
}

function changeNameFromDir(changeDir: string): string {
  const segments = changeDir.split(/[\\/]+/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? "";
}

function failedEvent(runId: string, reason: string): Event {
  return { kind: "failed", runId, timestamp: nowIso(), reason };
}

function wildcardPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesPattern(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => wildcardPatternToRegExp(pattern).test(value));
}

interface TaskCounts {
  unchecked: number;
  total: number;
}

/** Counts the change's own `tasks.md` checkboxes, using the same line
 * convention as `task-checklist.ts` rather than a second, drifting copy of
 * it. Returns `undefined` when the file cannot be read at all — a signal
 * the callers deliberately treat as "unknown", never as "nothing remains"
 * (see design.md, "The chain counts tasks itself, and fails safe").
 *
 * This exists because `openspec status`'s artifact completeness answers a
 * different question: whether `tasks.md` EXISTS, not whether its tasks are
 * done. Reading the former as the latter is what archived two
 * unimplemented changes. */
async function countTasks(changeDir: string): Promise<TaskCounts | undefined> {
  let content: string;
  try {
    content = await readFile(path.join(changeDir, "tasks.md"), "utf8");
  } catch {
    return undefined;
  }
  let unchecked = 0;
  let total = 0;
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(TASK_CHECKBOX_LINE_RE);
    if (!match) continue;
    total += 1;
    if ((match[1] ?? "").toLowerCase() !== "x") unchecked += 1;
  }
  return { unchecked, total };
}

interface MechanicalCheckOutcomeEntry {
  text: string;
  check: TaskCheckDeclaration;
  result: MechanicalCheckResult;
}

interface MechanicalCheckRunOutcome {
  /** `false` when the change's `tasks.md` declares no checks at all —
   * task 3.5: behaves exactly as before this capability existed. */
  ranAny: boolean;
  passed: MechanicalCheckOutcomeEntry[];
  failed: MechanicalCheckOutcomeEntry[];
}

/** Runs every mechanical check the change's `tasks.md` declares (task
 * 3.1), before the `verify` stage's agent is ever invoked, and writes
 * each one's pass/fail result onto its own checkbox (task 3.2) — the
 * ONLY writer of those checkboxes; an agent's own report never reaches
 * them through this path. Reading and parsing `tasks.md` itself is what
 * throws `UnknownMechanicalCheckError`/`InvalidMechanicalCheckParameterError`
 * for a malformed declaration (task-checklist.ts) — this function does
 * not catch those, so a malformed `tasks.md` fails the stage exactly like
 * a failing check would (via the caller's own try/catch). */
async function runMechanicalChecksForVerify(workspaceRoot: string, changeDir: string): Promise<MechanicalCheckRunOutcome> {
  const changeName = changeNameFromDir(changeDir);
  const items = await readTaskChecklist(workspaceRoot, changeName, false);
  const withChecks = items.filter((item) => item.check !== undefined);
  if (withChecks.length === 0) {
    return { ranAny: false, passed: [], failed: [] };
  }

  const ctx: MechanicalCheckContext = { workspaceRoot, changeDir, changeName };
  const passed: MechanicalCheckOutcomeEntry[] = [];
  const failed: MechanicalCheckOutcomeEntry[] = [];
  const updates: Array<{ lineNumber: number; expectedText: string; done: boolean }> = [];

  for (const item of withChecks) {
    const check = item.check as TaskCheckDeclaration;
    const result = await runMechanicalCheck(check.name, check.param, ctx);
    updates.push({ lineNumber: item.lineNumber, expectedText: item.text, done: result.pass });
    (result.pass ? passed : failed).push({ text: item.text, check, result });
  }

  await writeTaskCheckStates(workspaceRoot, changeName, false, updates);
  return { ranAny: true, passed, failed };
}

/** Renders passing checks' results for the verifying agent's own prompt
 * (task 3.4) — so it is told what is already established and does not
 * re-run `npm run typecheck`/`lint`/`test`/etc itself. Plain text, not
 * Markdown the agent could mistake for an instruction — same posture
 * `security.ts`'s other prompt sections take toward change-file content. */
function buildEstablishedChecksSection(passed: readonly MechanicalCheckOutcomeEntry[]): string {
  const lines = passed.map((entry) => {
    const paramSuffix = entry.check.param ? ` (${entry.check.param})` : "";
    return `- ${entry.check.name}${paramSuffix}: ${entry.result.reason}`;
  });
  return `The following mechanical checks already ran and passed — do not repeat them:\n${lines.join("\n")}`;
}

/** Determines the first not-yet-complete stage for a change. Whether the
 * `propose` artifacts exist still comes from the `status` command (that is
 * exactly the question artifact presence answers), but the `apply` vs
 * `verify` decision comes from the change's real task checkboxes —
 * `status.progress` is deliberately not consulted here, because it is
 * absent for the CLI shape this repository actually runs, and the value
 * that used to be synthesized in its place counted artifacts, not tasks.
 * `review` has no durable artifact of its own in the upstream
 * `openspec status` schema, so it is only ever the start stage as a side
 * effect of `propose` being incomplete — a chain resuming after `propose`
 * is already done starts at `apply` directly (this session's own `review`,
 * if any, already happened; a chain cannot tell whether an earlier one
 * did, and re-running it unconditionally on every resume would be
 * surprising and wasteful). A change whose tasks are all checked but is
 * not yet archived resumes at `verify`, not `archive` directly — the same
 * "an agent process exiting 0 is not evidence the work was done" reasoning
 * `runStage`'s archive gate already applies, applied one stage earlier. */
async function determineStartStage(cwd: string, changeName: string, changeDir: string): Promise<ChainStage> {
  const status = await statusChange(changeName, { cwd });
  const isDone = (artifactId: string): boolean =>
    status.artifacts.some((artifact) => {
      if (artifact.id !== artifactId) return false;
      const normalized = artifact.status.toLowerCase();
      return normalized === "done" || normalized === "complete";
    });
  const proposeDone = isDone("proposal") && isDone("design") && isDone("tasks");
  if (!proposeDone) return "propose";
  const tasks = await countTasks(changeDir);
  // Unknown progress picks the reversible stage: a redundant `apply` costs
  // one run, a wrong `archive` costs an unimplemented change.
  if (!tasks) return "apply";
  return tasks.unchecked > 0 ? "apply" : "verify";
}

export class HarnessChainRunner {
  private readonly active = new Map<string, ChainState>();

  constructor(private readonly deps: HarnessChainDeps) { }

  /** Starts a chain for a `"chain"` command. Returns an async generator —
   * every event (including every constituent stage's own `stdout`/
   * `stderr`/`progress`/`started`) is published under `command.runId`, per
   * ADR 0012. Only `"chain"` commands are accepted; anything else fails
   * immediately without side effects. */
  async *run(command: Command): AsyncGenerator<Event> {
    if (command.kind !== "chain") {
      yield failedEvent(command.runId, `HarnessChainRunner.run only accepts "chain" commands, got "${command.kind}"`);
      return;
    }

    const state: ChainState = { cancelRequested: false };
    this.active.set(command.runId, state);
    try {
      yield* this.runChain(command, state);
    } finally {
      this.active.delete(command.runId);
    }
  }

  /** Resumes a chain paused at a checkpoint. Returns `false` if no chain
   * is currently paused for `runId` (already resumed, cancelled, or never
   * existed) — the caller should treat that as a no-op, not an error. */
  confirmCheckpoint(runId: string): boolean {
    const state = this.active.get(runId);
    if (!state?.pendingCheckpoint) return false;
    const { resolve } = state.pendingCheckpoint;
    state.pendingCheckpoint = undefined;
    resolve("confirmed");
    return true;
  }

  /** Ends a chain — immediately if it is paused at a checkpoint (fully
   * within this runner's control), or by cancelling the currently running
   * stage's own run otherwise. Mid-stage cancellation reuses the existing
   * single-stage convention (`RunController.cancel()`: re-send a
   * `"cancel"`-kind `Command` to the same runner) — that runner (see
   * `agent-runner.ts`'s `createAgentRunner`) now aborts the `AbortSignal`
   * it gave that run's adapter, which every adapter forwards to
   * `spawnAndStream`, which terminates the spawned process tree (not only
   * the direct child — see `agents/shared.ts`). The chain stops advancing
   * to a further stage AND the underlying CLI process is terminated.
   * Returns `false` only if `runId` names no active chain at all. */
  cancel(runId: string): boolean {
    const state = this.active.get(runId);
    if (!state) return false;

    state.cancelRequested = true;
    if (state.pendingCheckpoint) {
      const { resolve } = state.pendingCheckpoint;
      state.pendingCheckpoint = undefined;
      resolve("cancelled");
      return true;
    }
    if (state.currentRunner && state.currentCommand) {
      const runner = state.currentRunner;
      const cancelCommand: Command = { ...state.currentCommand, kind: "cancel" };
      void (async () => {
        for await (const _event of runner.run(cancelCommand)) {
          // Draining only. Forwarding these events to a listener is each
          // single-stage run's own concern (mirrors `RunController`); the
          // chain's own event stream already reflects "ending" via the
          // `cancelled` event `runChain` emits once the current stage's
          // `run()` call above returns.
        }
      })();
    }
    return true;
  }

  /** Adapts this runner to the generic `AgentRunner` shape, for hosts that
   * dispatch through a single-runner-at-a-time abstraction already built
   * for single-stage commands (e.g. `packages/extension/src/run-
   * controller.ts`'s `RunController`, which tracks one active `{runner,
   * command}` pair and re-sends a `"cancel"`-kind `Command` to it on
   * `cancel()`). Unlike `run()` above, the returned `AgentRunner` also
   * accepts a `"cancel"` command — routed to this instance's own
   * `cancel()` rather than rejected — so such a host's generic cancel path
   * works unmodified against an active chain. Yields no events for
   * `"cancel"` itself: the chain's own `run()` stream (already being
   * consumed elsewhere, by construction, since a "cancel" can only target
   * a chain already running) emits `"cancelled"` when it takes effect. */
  asAgentRunner(): AgentRunner {
    return {
      run: (command: Command): AsyncIterable<Event> => {
        if (command.kind === "cancel") {
          const known = this.cancel(command.runId);
          // Reports that the request registered. The chain's own stream
          // says `cancelled` later, once the stage's run has actually
          // ended — which, since cancel-reports-what-happened, means once
          // its process is gone. Returning nothing here left the panel
          // with no sign the click had landed, on exactly the path the
          // 2026-09-03 report came from.
          const runId = command.runId;
          return (async function* cancelling(): AsyncGenerator<Event> {
            yield {
              kind: "cancelling",
              runId,
              timestamp: nowIso(),
              attempted: known ? "termination-requested" : "nothing-to-cancel",
            };
          })();
        }
        return this.run(command);
      },
    };
  }

  private async *runChain(command: Command, state: ChainState): AsyncGenerator<Event> {
    const { cwd, context, runId } = command;
    yield { kind: "started", runId, timestamp: nowIso(), command: "chain", cwd };

    const changeName = changeNameFromDir(context.changeDir);
    if (!changeName) {
      yield failedEvent(runId, "failed to resolve change name from command.context.changeDir");
      return;
    }

    let harnessConfig: HarnessConfig;
    try {
      harnessConfig = await resolveHarnessConfig(cwd, changeName);
    } catch (error) {
      yield failedEvent(runId, error instanceof Error ? error.message : String(error));
      return;
    }

    if (harnessConfig.autonomyLevel === "assisted") {
      yield failedEvent(
        runId,
        `this change's Agentic Harness autonomyLevel is "assisted" — start each stage individually instead of running a chain`,
      );
      return;
    }

    if (harnessConfig.autonomyLevel === "autonomous") {
      // Re-derive from the per-change file directly rather than trusting
      // the already-merged `harnessConfig` — see design.md, "checkpoints...
      // provenance is re-derived, not trusted from the merged config".
      let changeOverride: Partial<HarnessConfig> | undefined;
      try {
        changeOverride = await readChangeHarnessConfig(cwd, changeName);
      } catch (error) {
        yield failedEvent(runId, error instanceof Error ? error.message : String(error));
        return;
      }
      if (changeOverride?.autonomyLevel !== "autonomous") {
        yield failedEvent(
          runId,
          `autonomyLevel "autonomous" is only reachable when this change's own openspec/changes/${changeName}/harness.json sets it directly — it is not settable globally, and inheriting it from elsewhere is refused`,
        );
        return;
      }
    }

    let startStage: ChainStage;
    try {
      startStage = await determineStartStage(cwd, changeName, context.changeDir);
    } catch (error) {
      yield failedEvent(runId, error instanceof Error ? error.message : String(error));
      return;
    }

    const sequence = CHAIN_STAGES.slice(CHAIN_STAGES.indexOf(startStage));

    // Populated around the "apply" stage only (see `captureApplyCheckpoint`/
    // `finalizeApplyCheckpoint`), and handed to the "verify" stage's own
    // Command when that stage runs. Stays `undefined` for any chain that
    // doesn't run "apply" itself (e.g. resuming directly at "verify") — a
    // verify stage with no delta available runs with the prompt it would
    // have produced before this capability existed, per security.ts's
    // absent-field path.
    let verifiedDelta: VerifiedDeltaEntry[] | undefined;

    for (let index = 0; index < sequence.length; index += 1) {
      const stage = sequence[index] as ChainStage;
      const hasNextStage = index < sequence.length - 1;

      // Checked BEFORE the stage starts, never during it — a stage
      // already running is never interrupted by this check (ADR 0018
      // decision 7: a run's cost is not known until it ends). Do not
      // "also check during the run" here; that is exactly the mid-run
      // interruption ADR 0018 rejects.
      const budgetReason = await this.checkBudget(harnessConfig, context.changeDir);
      if (budgetReason) {
        yield failedEvent(runId, budgetReason);
        return;
      }

      // Re-derive the high-impact gate from the change's own file
      // immediately before archive moves that file out of the active
      // changes directory. Reading it after a successful archive always
      // resolves to "not configured" and silently skips the git stage.
      let shouldRunGitAfterArchive: boolean | undefined;
      if (stage === "archive" && sequence[index + 1] === "git") {
        try {
          shouldRunGitAfterArchive = await this.shouldRunGitStage(cwd, changeName);
        } catch (error) {
          yield failedEvent(runId, error instanceof Error ? error.message : String(error));
          return;
        }
      }

      const applyCheckpoint = stage === "apply" ? await this.captureApplyCheckpoint(cwd) : undefined;

      const outcome = yield* this.runStage(stage, hasNextStage, harnessConfig, command, state, verifiedDelta);

      if (stage === "apply" && applyCheckpoint && outcome === "completed") {
        verifiedDelta = await this.finalizeApplyCheckpoint(applyCheckpoint);
      }

      if (outcome !== "completed") return;
      if (!hasNextStage) return;

      if (stage === "archive" && sequence[index + 1] === "git") {
        if (!shouldRunGitAfterArchive) {
          yield { kind: "completed", runId, timestamp: nowIso(), summary: `archived ${changeName}` };
          return;
        }
      }

      if (state.cancelRequested) {
        yield { kind: "cancelled", runId, timestamp: nowIso() };
        return;
      }

      const nextStage = sequence[index + 1] as ChainStage;
      const requireConfirmation = harnessConfig.autonomyLevel === "semi-autonomous"
        && harnessConfig.checkpoints?.requireConfirmationBetweenSteps !== false;

      if (requireConfirmation) {
        // `state.pendingCheckpoint` is registered BEFORE yielding the
        // checkpoint event, not after: a real consumer (or this module's
        // own tests) reacts to a yielded event synchronously, before this
        // generator gets a chance to resume and run any code that comes
        // after the `yield`. Registering the resolver first closes that
        // window — `confirmCheckpoint()`/`cancel()` called the instant the
        // event is observed will always find a pending resolver to settle,
        // rather than racing a promise that has not been constructed yet.
        const checkpointPromise = new Promise<CheckpointOutcome>((resolve) => {
          state.pendingCheckpoint = { resolve };
        });
        yield {
          kind: "checkpoint",
          runId,
          timestamp: nowIso(),
          stage,
          nextStage,
          // "archive"/"git" have no agent (mechanical, or a dedicated
          // non-agent sequence) — "" reads as "no agent required for the
          // next stage", not "unknown". Reused from harness-config.ts
          // rather than re-listing the two stage names here — see
          // harness-step-agent.ts's `HarnessStepAgentStage` comment for
          // why they are kept on one list, together.
          nextAgentId: !isHarnessStepAgentStage(nextStage)
            ? ""
            : (harnessConfig.stepAgents[nextStage] === undefined
              ? ""
              : normalizeStepAgent(harnessConfig.stepAgents[nextStage]).agent),
        };
        const checkpointOutcome = await checkpointPromise;
        if (checkpointOutcome === "cancelled") {
          yield { kind: "cancelled", runId, timestamp: nowIso() };
          return;
        }
      } else {
        yield { kind: "stageCompleted", runId, timestamp: nowIso(), stage, nextStage };
      }
    }
  }

  /** Returns a failure reason naming the budget, or `undefined` when the
   * stage is free to start. `undefined` whenever there is nothing to
   * check against: no `budget` configured, no `listAuditEntries`
   * dependency supplied, or no recorded usage yet for this change — see
   * spec.md, "A configured budget stops work at stage boundaries" and
   * task 8.5 (runs with no `usage` contribute nothing to the total, so a
   * change whose runs are all unmeasured never trips the ceiling). */
  private async checkBudget(harnessConfig: HarnessConfig, changeDir: string): Promise<string | undefined> {
    const budget = harnessConfig.budget;
    if (!budget || (budget.maxCostUsd === undefined && budget.maxTokens === undefined)) return undefined;
    if (!this.deps.listAuditEntries) return undefined;

    const entries = await this.deps.listAuditEntries();
    const total = buildUsageReport(entries).totalsByChange[changeDir];
    if (!total) return undefined;

    if (budget.maxCostUsd !== undefined && total.costUsd >= budget.maxCostUsd) {
      return `budget exceeded: recorded cost $${total.costUsd.toFixed(2)} for this change has reached the configured ceiling ($${budget.maxCostUsd.toFixed(2)}) — stopping before the next stage, not because a stage failed`;
    }
    if (budget.maxTokens !== undefined) {
      const totalTokens = total.inputTokens + total.outputTokens;
      if (totalTokens >= budget.maxTokens) {
        return `budget exceeded: recorded tokens (${totalTokens}) for this change have reached the configured ceiling (${budget.maxTokens}) — stopping before the next stage, not because a stage failed`;
      }
    }
    return undefined;
  }

  /** Best-effort start of the "apply" stage's own checkpoint, so its delta
   * can later be handed to "verify" — never lets checkpointing stop the
   * chain: a size-limit error (`captureCheckpoint` throws when the
   * workspace exceeds its configured limits) or any other failure here
   * just means "verify" runs without a delta, exactly as if this
   * capability didn't exist (see security.ts's absent-field path). */
  private async captureApplyCheckpoint(cwd: string): Promise<WorkbenchCheckpoint | undefined> {
    try {
      return await captureCheckpoint(cwd);
    } catch {
      return undefined;
    }
  }

  /** Turns a finalized "apply" checkpoint into the `VerifiedDeltaEntry[]`
   * shape `security.ts` renders into the "verify" stage's prompt — content
   * comes from the checkpoint's own before/after snapshots, never from
   * `GitWrapper.diff()` (see design.md's rejected alternative). Best-effort
   * for the same reason `captureApplyCheckpoint` is. */
  private async finalizeApplyCheckpoint(checkpoint: WorkbenchCheckpoint): Promise<VerifiedDeltaEntry[] | undefined> {
    try {
      const delta = await finalizeCheckpoint(checkpoint);
      if (delta.length === 0) return undefined;
      return delta.map((entry) => ({
        path: entry.path,
        kind: entry.kind,
        before: checkpoint.before.get(entry.path)?.content.toString("utf8"),
        after: checkpoint.after?.get(entry.path)?.content.toString("utf8"),
      }));
    } catch {
      return undefined;
    }
  }

  /** Runs one stage to its own terminal outcome. For an intermediate stage
   * (`hasNextStage`), the stage's own raw `"completed"` event is
   * deliberately swallowed rather than forwarded — per ADR 0012,
   * `"completed"`/`"failed"`/`"cancelled"` are reserved, for a chain run,
   * for when the WHOLE CHAIN ends, not each stage; the caller replaces a
   * swallowed `"completed"` with `"checkpoint"`/`"stageCompleted"`. A
   * `"failed"`/`"cancelled"` stage outcome always ends the whole chain, so
   * it is forwarded as-is regardless of `hasNextStage`. */
  private async *runStage(
    stage: ChainStage,
    hasNextStage: boolean,
    harnessConfig: HarnessConfig,
    command: Command,
    state: ChainState,
    verifiedDelta: VerifiedDeltaEntry[] | undefined,
  ): AsyncGenerator<Event, "completed" | "failed" | "cancelled"> {
    const { cwd, context, runId } = command;

    if (stage === "git") {
      return yield* this.runGitStage(command, harnessConfig, hasNextStage);
    }

    if (stage === "archive") {
      // The archive stage is irreversible, and a stage exiting successfully
      // is not evidence the work was done — an agent process can exit `0`
      // having changed nothing. Refuse on anything short of "every task
      // checked", including a task count that cannot be read at all.
      const tasks = await countTasks(context.changeDir);
      if (!tasks || tasks.unchecked > 0) {
        const changeName = changeNameFromDir(context.changeDir);
        yield failedEvent(
          runId,
          tasks
            ? `cannot archive "${changeName}": ${tasks.unchecked} task(s) still unchecked; complete or verify them, then archive`
            : `cannot archive "${changeName}": its tasks.md could not be read, so task completion is unknown; verify the change, then archive`,
        );
        return "failed";
      }
      try {
        await archiveChange(changeNameFromDir(context.changeDir), { cwd });
      } catch (error) {
        yield failedEvent(runId, error instanceof Error ? error.message : String(error));
        return "failed";
      }
      if (!hasNextStage) {
        yield { kind: "completed", runId, timestamp: nowIso(), summary: `archived ${changeNameFromDir(context.changeDir)}` };
      }
      return "completed";
    }

    let verifyCheckOutcome: MechanicalCheckRunOutcome | undefined;
    if (stage === "verify") {
      // Mechanical checks (task-checklist.ts's `check` declarations) run
      // BEFORE the verifying agent — task 3.1/3.3. A failure here skips
      // the agent entirely: asking a model to review work that a
      // mechanical check already found broken spends a run to learn what
      // an exit code already said. A change whose tasks.md declares no
      // checks (`ranAny: false`) falls straight through unchanged — task
      // 3.5.
      try {
        verifyCheckOutcome = await runMechanicalChecksForVerify(cwd, context.changeDir);
      } catch (error) {
        yield failedEvent(runId, error instanceof Error ? error.message : String(error));
        return "failed";
      }
      if (verifyCheckOutcome.failed.length > 0) {
        const failedSummary = verifyCheckOutcome.failed
          .map((entry) => `${entry.check.name}${entry.check.param ? `(${entry.check.param})` : ""}: ${entry.result.reason}`)
          .join("; ");
        yield failedEvent(runId, `mechanical checks failed, verifying agent was not invoked: ${failedSummary}`);
        return "failed";
      }
    }

    const stepAgent = harnessConfig.stepAgents[stage];
    const { agent: agentId, model, effort, budget } = stepAgent === undefined
      ? { agent: undefined, model: undefined, effort: undefined, budget: undefined }
      : normalizeStepAgent(stepAgent);
    const runner = this.deps.resolveRunner(agentId);
    if (!runner) {
      yield failedEvent(runId, `no agent available to run the "${stage}" stage`);
      return "failed";
    }

    // Only the "verify" stage's context carries a delta and/or an
    // "established checks" section — every other stage keeps the exact
    // same `context` object the top-level command was given, so its
    // prompt stays byte-identical to before this stage existed (see
    // security.ts, buildVerifiedDeltaSection's absent-field path).
    let stageContext: CommandContext = context;
    if (stage === "verify") {
      if (verifiedDelta) stageContext = { ...stageContext, verifiedDelta };
      if (verifyCheckOutcome && verifyCheckOutcome.ranAny && verifyCheckOutcome.passed.length > 0) {
        const establishedSection = buildEstablishedChecksSection(verifyCheckOutcome.passed);
        stageContext = {
          ...stageContext,
          promptContext: stageContext.promptContext
            ? `${stageContext.promptContext}\n\n${establishedSection}`
            : establishedSection,
        };
      }
    }
    const stageCommand: Command = { kind: CHAIN_STAGE_COMMAND[stage], cwd, context: stageContext, runId, agentId, model, effort, budget };
    state.currentRunner = runner;
    state.currentCommand = stageCommand;

    let outcome: "completed" | "failed" | "cancelled" = "completed";
    for await (const event of runner.run(stageCommand)) {
      if (event.kind === "completed") {
        outcome = "completed";
        if (hasNextStage) continue;
        yield event;
        continue;
      }
      if (event.kind === "failed") outcome = "failed";
      if (event.kind === "cancelled") outcome = "cancelled";
      yield event;
    }

    state.currentRunner = undefined;
    state.currentCommand = undefined;
    return outcome;
  }

  private async shouldRunGitStage(workspaceRoot: string, changeName: string): Promise<boolean> {
    const changeOverride = await readChangeHarnessConfig(workspaceRoot, changeName);
    return changeOverride?.reviewGate?.mode === "agent-sufficient";
  }

  private buildGitStageAllowlist(harnessConfig: HarnessConfig): AllowlistConfig {
    const remotes = harnessConfig.gitStageAllowlist?.remotes ?? [];
    const branches = harnessConfig.gitStageAllowlist?.branches ?? [];
    return {
      [GIT_STAGE_AGENT_NAME]: [
        {
          executable: "git",
          argsAllowed: (args: string[]) => {
            if (args[0] !== "push") return false;
            const remote = args[1] ?? "";
            const branch = args[2] ?? "";
            return matchesPattern(remote, remotes) && matchesPattern(branch, branches);
          },
        },
        {
          executable: "gh",
          argsAllowed: (args: string[]) => {
            if (args[0] !== "pr") return false;
            if (args[1] === "create") {
              const headIndex = args.indexOf("--head");
              const baseIndex = args.indexOf("--base");
              const headBranch = headIndex >= 0 ? args[headIndex + 1] ?? "" : "";
              const baseBranch = baseIndex >= 0 ? args[baseIndex + 1] ?? "" : "";
              return matchesPattern(DEFAULT_GIT_REMOTE, remotes)
                && matchesPattern(headBranch, branches)
                && matchesPattern(baseBranch, branches);
            }
            if (args[1] === "merge") {
              return matchesPattern(DEFAULT_GIT_REMOTE, remotes);
            }
            return false;
          },
        },
      ],
    };
  }

  private recordGitAction(
    command: Command,
    invocation: AdapterInvocation,
    outcome: "blocked" | "started" | "completed" | "failed",
    details?: { reason?: string; summary?: string },
  ): void {
    this.deps.auditLog?.record({
      runId: command.runId,
      agent: GIT_STAGE_AGENT_NAME,
      outcome,
      cwd: command.cwd,
      timestamp: nowIso(),
      changeDir: command.context.changeDir,
      invocation,
      reason: details?.reason,
      summary: details?.summary,
    });
  }

  private async *runGitStage(
    command: Command,
    harnessConfig: HarnessConfig,
    hasNextStage: boolean,
  ): AsyncGenerator<Event, "completed" | "failed" | "cancelled"> {
    const allowlistRules = harnessConfig.gitStageAllowlist;
    if (!allowlistRules) {
      yield failedEvent(command.runId, "git stage requires a per-change gitStageAllowlist");
      return "failed";
    }

    const git = (this.deps.createGitWrapper ?? createGitWrapper)({ cwd: command.cwd });
    const prGateway = (this.deps.createPullRequestGateway ?? createPullRequestGateway)({ cwd: command.cwd });
    const allowlist = this.buildGitStageAllowlist(harnessConfig);

    const branch = await git.currentBranch();
    if (!branch) {
      yield failedEvent(command.runId, "git stage failed: could not resolve current branch");
      return "failed";
    }

    const pushInvocation: AdapterInvocation = {
      kind: "process",
      ...buildGitPushInvocation(DEFAULT_GIT_REMOTE, branch),
    };
    const pushDecision = checkAllowlist(GIT_STAGE_AGENT_NAME, pushInvocation, allowlist);
    if (!pushDecision.allowed) {
      this.recordGitAction(command, pushInvocation, "blocked", { reason: pushDecision.reason });
      yield failedEvent(command.runId, `git stage failed at push: ${pushDecision.reason ?? "blocked by allowlist"}`);
      return "failed";
    }
    this.recordGitAction(command, pushInvocation, "started");
    try {
      await git.push(DEFAULT_GIT_REMOTE, branch);
      this.recordGitAction(command, pushInvocation, "completed", { summary: `pushed ${branch}` });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.recordGitAction(command, pushInvocation, "failed", { reason });
      yield failedEvent(command.runId, `git stage failed at push: ${reason}`);
      return "failed";
    }

    const createInvocation: AdapterInvocation = {
      kind: "process",
      ...buildGhPrCreateInvocation(branch, DEFAULT_PR_BASE_BRANCH),
    };
    const createDecision = checkAllowlist(GIT_STAGE_AGENT_NAME, createInvocation, allowlist);
    if (!createDecision.allowed) {
      this.recordGitAction(command, createInvocation, "blocked", { reason: createDecision.reason });
      yield failedEvent(command.runId, `git stage failed at pull-request creation: ${createDecision.reason ?? "blocked by allowlist"}`);
      return "failed";
    }

    this.recordGitAction(command, createInvocation, "started");
    let pr: { number: number; url: string };
    try {
      pr = await prGateway.createPullRequest(branch, DEFAULT_PR_BASE_BRANCH);
      this.recordGitAction(command, createInvocation, "completed", { summary: `created PR ${pr.url}` });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.recordGitAction(command, createInvocation, "failed", { reason });
      yield failedEvent(command.runId, `git stage failed at pull-request creation: ${reason}`);
      return "failed";
    }

    let checks;
    try {
      checks = await prGateway.waitForChecks(pr.number);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      yield failedEvent(command.runId, `git stage failed while checking pull-request checks: ${reason}`);
      return "failed";
    }
    if (checks.state !== "pass") {
      const suffix = checks.reason ? `: ${checks.reason}` : "";
      yield failedEvent(command.runId, `git stage failed at pull-request checks${suffix}`);
      return "failed";
    }

    const mergeInvocation: AdapterInvocation = {
      kind: "process",
      ...buildGhPrMergeInvocation(pr.number),
    };
    const mergeDecision = checkAllowlist(GIT_STAGE_AGENT_NAME, mergeInvocation, allowlist);
    if (!mergeDecision.allowed) {
      this.recordGitAction(command, mergeInvocation, "blocked", { reason: mergeDecision.reason });
      yield failedEvent(command.runId, `git stage failed at pull-request merge: ${mergeDecision.reason ?? "blocked by allowlist"}`);
      return "failed";
    }

    this.recordGitAction(command, mergeInvocation, "started");
    try {
      await prGateway.mergePullRequest(pr.number);
      this.recordGitAction(command, mergeInvocation, "completed", { summary: `merged PR ${pr.url}` });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.recordGitAction(command, mergeInvocation, "failed", { reason });
      yield failedEvent(command.runId, `git stage failed at pull-request merge: ${reason}`);
      return "failed";
    }

    if (!hasNextStage) {
      yield { kind: "completed", runId: command.runId, timestamp: nowIso(), summary: `merged ${pr.url}` };
    }
    return "completed";
  }
}
