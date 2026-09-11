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
import {
  runDeclaredChecks,
  type DeclaredCheckOutcomeEntry,
  type DeclaredCheckRunOutcome,
} from "./declared-checks.js";
import type { Command, CommandContext, CommandKind, Event, VerifiedDeltaEntry } from "./protocol.js";
import {
  type HarnessChainStep,
  type HarnessConfig,
  isHarnessStepAgentStage,
  normalizeStepAgent,
  readChangeHarnessConfig,
  resolveHarnessConfig,
} from "./harness-config.js";
import { archiveChange, statusChange } from "./openspec.js";
import {
  DEFAULT_CHAIN_STEP_MAX_WAIT_MS,
  isWaitingStep,
  runChainStep,
} from "./chain-steps.js";
import { VERIFY_CHECKS_AGENT_NAME } from "./audit-runs.js";
import { DEFAULT_AGENT_ID } from "./agents/registry.js";
import { checkAllowlist, type AllowlistConfig, type AuditEntry, type AuditLog } from "./security.js";
import type { AgentUsage } from "./agent-usage.js";
import { readTaskChecklist, TASK_CHECKBOX_LINE_RE, writeTaskCheckStates } from "./task-checklist.js";
import { buildUsageReport, type UsageTotal } from "./usage-report.js";

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
  /** Why this chain was cancelled, when something other than a person
   * asking caused it. Set before `cancel()` is called so the terminal
   * `cancelled` event can name the rule that fired; left unset by a
   * person's cancel, which is what an absent reason has always meant. */
  cancelReason?: string;
  /** Why the chain came back to an earlier stage, set just before it
   * does. Consumed by the next attempt's `stageStarted`, so a stage
   * appearing twice says why rather than looking like a duplicate. */
  returnReason?: string;
  /** Set by `runStage` when `verify`'s mechanical checks failed, so the
   * chain loop — which is the only place that knows whether a return to
   * `apply` is possible — decides between sending the work back and
   * failing. `runStage` yields no event for this; the loop yields one or
   * the other. */
  checkFailureSummary?: string;
  /** How many times each stage has been attempted, counting the first.
   * Kept on the chain rather than inside the stage loop because a chain
   * returning from `verify` to `apply` re-enters that loop, and a count
   * local to it would reset — letting a chain retry forever against a
   * ceiling it appeared to respect. Per stage, so a slow `verify` never
   * consumes the allowance meant for `apply`. */
  attemptsByStage: Map<ChainStage, number>;
  /** What the stage currently running reported spending, if it reported
   * anything. Cleared when a stage starts, so it never carries a previous
   * stage's figure into this one's check. Absent means the agent reported
   * nothing, which is not zero — the case a spending ceiling cannot act
   * on at all. */
  lastStageUsage?: AgentUsage;
  /** Time the chain's stages have spent, summed, in milliseconds. Time
   * waiting at a checkpoint is deliberately not added: a person
   * deliberating is not a run consuming anything, and counting it would
   * fire the ceiling on chains behaving exactly as configured. */
  elapsedMs: number;
  pendingCheckpoint?: { resolve: (outcome: CheckpointOutcome) => void };
  currentRunner?: AgentRunner;
  currentCommand?: Command;
}

function nowIso(): string {
  return new Date().toISOString();
}

function formatSeconds(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.round(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m${String(seconds).padStart(2, "0")}s`;
}

/** The tasks still unchecked, as a readable list for a terminal message.
 * Named rather than counted because a reader seeing this is about to take
 * the work over, and `archive`'s own refusal already gives them a count —
 * which of them is the part that otherwise costs opening the file.
 * Truncated, because a change with forty open tasks would otherwise
 * produce a message nobody reads. */
async function unfinishedTaskTexts(workspaceRoot: string, changeName: string): Promise<string> {
  let items;
  try {
    items = await readTaskChecklist(workspaceRoot, changeName, false);
  } catch {
    // The count that got us here was read successfully; if the list
    // cannot be, the message still has to be useful.
    return "the task list could not be read to name them";
  }
  const open = items.filter((item) => !item.done).map((item) => item.text);
  if (open.length === 0) return "none, which contradicts the count just read";
  const shown = open.slice(0, 5);
  const suffix = open.length > shown.length ? `, and ${open.length - shown.length} more` : "";
  return shown.map((text) => `"${text}"`).join(", ") + suffix;
}

/** Names the per-stage ceiling a finished stage exceeded, or `undefined`
 * when none was configured, none was exceeded, or the agent reported
 * nothing to compare. That last case is not a pass — it is the ceiling
 * having nothing to act on, which is exactly what `timeout` exists to
 * cover, and it is why this returns `undefined` rather than treating an
 * absent figure as zero. */
function describeStageOverspend(
  config: HarnessConfig,
  usage: AgentUsage | undefined,
  stage: ChainStage,
): string | undefined {
  if (!usage) return undefined;
  const maxCostUsd = config.budget?.maxStageCostUsd;
  if (maxCostUsd !== undefined && usage.costUsd !== undefined && usage.costUsd > maxCostUsd) {
    return `stopped after "${stage}": it reported $${usage.costUsd.toFixed(2)},`
      + ` over budget.maxStageCostUsd of $${maxCostUsd.toFixed(2)}`;
  }
  const maxTokens = config.budget?.maxStageTokens;
  if (maxTokens !== undefined) {
    const used = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
    if ((usage.inputTokens !== undefined || usage.outputTokens !== undefined) && used > maxTokens) {
      return `stopped after "${stage}": it reported ${used.toLocaleString()} tokens,`
        + ` over budget.maxStageTokens of ${maxTokens.toLocaleString()}`;
    }
  }
  return undefined;
}

/** Names the ceiling that fired and the value it was set to, rather than
 * blaming the stage that happened to be running — the posture
 * `checkBudget` already takes when it stops a chain. */
function describeTimeout(config: HarnessConfig, state: ChainState, stage: ChainStage): string {
  const runSeconds = config.timeout?.maxRunSeconds;
  const stageSeconds = config.timeout?.maxStageSeconds;
  const remainingRunMs = runSeconds === undefined ? undefined : Math.max(0, runSeconds * 1000 - state.elapsedMs);
  const stageMs = stageSeconds === undefined ? undefined : stageSeconds * 1000;
  const runFiredFirst = remainingRunMs !== undefined && (stageMs === undefined || remainingRunMs <= stageMs);
  if (runFiredFirst) {
    return `stopped at the run time limit: timeout.maxRunSeconds is ${runSeconds}s`
      + `, and this chain's stages had already spent ${formatSeconds(state.elapsedMs)} before "${stage}" started`;
  }
  return `stopped "${stage}" at the stage time limit: timeout.maxStageSeconds is ${stageSeconds}s`;
}

function changeNameFromDir(changeDir: string): string {
  const segments = changeDir.split(/[\\/]+/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? "";
}

function failedEvent(runId: string, reason: string): Event {
  return { kind: "failed", runId, timestamp: nowIso(), reason };
}

/** Which agent this chain's `apply` stage runs as — the agent whose work
 * a later `verify` stage's checks examine.
 *
 * An unset `apply` entry falls back to `DEFAULT_AGENT_ID`, which is the
 * same fallback `resolveRunner` applies (`default-runners.ts`), so the
 * name recorded here matches the `agent` the apply stage's own audit
 * entries carry and the two group together. */
function resolvedApplyAgent(harnessConfig: HarnessConfig): string {
  const entry = harnessConfig.stepAgents.apply;
  return entry === undefined ? DEFAULT_AGENT_ID : normalizeStepAgent(entry).agent;
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

type MechanicalCheckOutcomeEntry = DeclaredCheckOutcomeEntry;
type MechanicalCheckRunOutcome = DeclaredCheckRunOutcome;

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
  const outcome = await runDeclaredChecks(workspaceRoot, changeName, false);
  if (!outcome.ranAny) return outcome;

  // The writing is what makes this the `verify` stage's version rather
  // than `runDeclaredChecks` itself: a checkbox records what a check
  // found during a run, and `openspec-ui-cli check` — which asks the same
  // question outside a run — deliberately writes nothing.
  await writeTaskCheckStates(
    workspaceRoot,
    changeName,
    false,
    [...outcome.passed, ...outcome.failed].map((entry) => ({
      lineNumber: entry.lineNumber,
      expectedText: entry.text,
      done: entry.result.pass,
    })),
  );
  return outcome;
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
  // `design` is deliberately not required. A change may carry none — the
  // validator accepts that, and three of this repository's own active
  // changes and many of its archived ones have no `design.md`. The status
  // command reports a missing artifact as `ready`, meaning "could be
  // produced"; reading that as an unfinished proposal sent a finished
  // change back to `propose` and re-proposed work that was already
  // written. A change that is genuinely mid-proposal has no task list
  // yet, which `tasks` already answers.
  // See design-is-optional-for-resume.
  const proposeDone = isDone("proposal") && isDone("tasks");
  if (!proposeDone) return "propose";
  const tasks = await countTasks(changeDir);
  // Unknown progress picks the reversible stage: a redundant `apply` costs
  // one run, a wrong `archive` costs an unimplemented change.
  if (!tasks) return "apply";
  return tasks.unchecked > 0 ? "apply" : "verify";
}

/** One entry in the sequence a chain actually runs: a fixed stage, or a
 * step this change declared. */
type ChainEntry =
  | { kind: "stage"; stage: ChainStage }
  | { kind: "step"; declaration: HarnessChainStep };

/** Places each declared step against the fixed sequence.
 *
 * A step is anchored to a stage, never to another step, so two
 * declarations can never depend on each other's order — and a step whose
 * anchor is not in this (already resumed-sliced) sequence is anchored to
 * work that already happened, so it does not run.
 *
 * Declaration order decides the order of two steps anchored to the same
 * side of the same stage, which is the only ordering question this can
 * be asked. */
function insertDeclaredSteps(
  stages: readonly ChainStage[],
  declared: readonly HarnessChainStep[] | undefined,
): ChainEntry[] {
  const entries: ChainEntry[] = [];
  for (const stage of stages) {
    for (const declaration of declared ?? []) {
      if (declaration.before === stage) entries.push({ kind: "step", declaration });
    }
    entries.push({ kind: "stage", stage });
    for (const declaration of declared ?? []) {
      if (declaration.after === stage) entries.push({ kind: "step", declaration });
    }
  }
  return entries;
}

/** The next fixed stage at or after `index`, skipping declared steps.
 *
 * The chain asks this only about `git`, and skipping steps is the whole
 * point: `git` is gated on `reviewGate.mode`, re-derived immediately
 * before `archive` moves the change's own file out of the active
 * directory. A version that looked only at the very next entry would see
 * a declared step there and conclude that `git` was not next — and the
 * chain would then walk into the git stage with its gate never
 * evaluated. Found by the test for a step declared after `archive`. */
function nextStageAfter(sequence: readonly ChainEntry[], index: number): ChainStage | undefined {
  for (let i = index; i < sequence.length; i += 1) {
    const entry = sequence[i];
    if (entry !== undefined && entry.kind === "stage") return entry.stage;
  }
  return undefined;
}

/** What one change has spent, gathered from every working directory that
 * recorded it — ADR 0022 decision 5.
 *
 * `totalsByChange` is keyed by the change directory's absolute path, and
 * that path is different in every git worktree of the same repository.
 * Looking the change up by its own path therefore finds only what this
 * directory recorded, so a ceiling would be permitted once per worktree
 * — which is exactly what summing the audit logs across worktrees was
 * meant to prevent, and did not, until this.
 *
 * Matched on the directory's last segment, which is the change's name:
 * `openspec/changes/<name>` is the only shape a change directory takes,
 * and every entry being summed came from one repository's own worktrees,
 * so two different changes cannot collide here.
 *
 * Found by running two chains in two worktrees for real. */
function totalForChange(
  totalsByChange: Record<string, UsageTotal>,
  changeDir: string,
): UsageTotal | undefined {
  const changeName = path.basename(changeDir);
  let found: UsageTotal | undefined;

  for (const [key, total] of Object.entries(totalsByChange)) {
    if (path.basename(key) !== changeName) continue;
    found = found
      ? {
        runCount: found.runCount + total.runCount,
        inputTokens: found.inputTokens + total.inputTokens,
        outputTokens: found.outputTokens + total.outputTokens,
        costUsd: found.costUsd + total.costUsd,
      }
      : total;
  }
  return found;
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

    const state: ChainState = { cancelRequested: false, elapsedMs: 0, attemptsByStage: new Map() };
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

  /** Forwards a `"resolvePermission"` command to the runner executing the
   * stage currently in flight for `runId`, unchanged — the driver's
   * `runId:requestId` key (`acp-session-driver.ts:231`) must match what it
   * stored, so the command is never rewritten on the way through. Returns
   * `false` when `runId` names no active chain at all, so a host falls
   * through to its own single-stage path. Returns `true` (a no-op) when
   * the chain is active but no stage is currently running — between
   * stages, or paused at a checkpoint — since an answer naming no pending
   * request is not an error (task 1.5). */
  resolvePermission(command: Command): boolean {
    const state = this.active.get(command.runId);
    if (!state) return false;
    const runner = state.currentRunner;
    if (!runner) return true;
    void (async () => {
      try {
        for await (const _event of runner.run(command)) {
          // Draining only — see `cancel()`'s identical shape above. A
          // `"resolvePermission"` command yields no events of its own; the
          // stage's own already-open stream is what continues.
        }
      } catch {
        // Same posture as `cancel()`: a runner throwing on an answer must
        // not become an unhandled rejection here.
      }
    })();
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
      // `state.cancelReason` is set before every ceiling's `cancel()` and
      // left unset by a person's, so this is exactly the distinction the
      // audit entry needs and cannot otherwise make.
      const cancelCommand: Command = {
        ...state.currentCommand,
        kind: "cancel",
        ...(state.cancelReason !== undefined ? { reason: state.cancelReason } : {}),
      };
      void (async () => {
        try {
          for await (const _event of runner.run(cancelCommand)) {
            // Draining only. Forwarding these events to a listener is each
            // single-stage run's own concern (mirrors `RunController`); the
            // chain's own event stream already reflects "ending" via the
            // `cancelled` event `runChain` emits once the current stage's
            // `run()` call above returns.
          }
        } catch {
          // A runner throwing synchronously on `"cancel"` must not become
          // an unhandled rejection here — see `resolvePermission()`'s
          // identical guard below.
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
        if (command.kind === "resolvePermission") {
          // Routes to the stage's own runner rather than letting it reach
          // `run()`, which accepts only `"chain"` — see `resolvePermission()`
          // above. No event is yielded here, mirroring `agent-runner.ts`'s
          // own `"resolvePermission"` branch: the stage's already-open
          // stream (a separate, still-open call to `run()` for the same
          // runId) is what continues.
          this.resolvePermission(command);
          return (async function* noEvents(): AsyncGenerator<Event> { })();
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

    // The sequence is what this change declares, not a constant — ADR
    // 0021. Steps are inserted AFTER the resume slice, so a step
    // anchored to a stage that already happened does not run, and one
    // anchored to the stage the chain resumes at does: reaching that
    // stage is exactly what it was placed before.
    const sequence = insertDeclaredSteps(
      CHAIN_STAGES.slice(CHAIN_STAGES.indexOf(startStage)),
      harnessConfig.steps,
    );

    // Populated around the "apply" stage only (see `captureApplyCheckpoint`/
    // `finalizeApplyCheckpoint`), and handed to the "verify" stage's own
    // Command when that stage runs. Stays `undefined` for any chain that
    // doesn't run "apply" itself (e.g. resuming directly at "verify") — a
    // verify stage with no delta available runs with the prompt it would
    // have produced before this capability existed, per security.ts's
    // absent-field path.
    let verifiedDelta: VerifiedDeltaEntry[] | undefined;

    // Set when `archive` has run and the review gate says `git` must not.
    // The git stage is then skipped while the rest of the sequence — a
    // step a change declared after `archive` — still runs, and the chain
    // reports the archive it actually performed.
    let gitStageSkipped = false;
    let archivedSummary: string | undefined;

    for (let index = 0; index < sequence.length; index += 1) {
      const entry = sequence[index] as ChainEntry;
      if (entry.kind === "stage" && entry.stage === "git" && gitStageSkipped) continue;
      if (entry.kind === "step") {
        const stepOk = yield* this.runDeclaredStep(entry.declaration, command, state, changeName);
        if (!stepOk) return;
        continue;
      }
      const stage = entry.stage;
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

      // The run ceiling, checked before a stage starts as well as during
      // one: a chain whose time is already spent must not start further
      // work, and reaching the ceiling is a rule firing rather than a
      // defect — so it cancels with a reason, where the budget check
      // above fails. The two differ deliberately; see design.md.
      const runSeconds = harnessConfig.timeout?.maxRunSeconds;
      if (runSeconds !== undefined && state.elapsedMs >= runSeconds * 1000) {
        yield {
          kind: "cancelled",
          runId,
          timestamp: nowIso(),
          reason: `stopped at the run time limit: timeout.maxRunSeconds is ${runSeconds}s`
            + `, and this chain's stages had spent ${formatSeconds(state.elapsedMs)} before "${stage}" could start`,
        };
        return;
      }

      // Re-derive the high-impact gate from the change's own file
      // immediately before archive moves that file out of the active
      // changes directory. Reading it after a successful archive always
      // resolves to "not configured" and silently skips the git stage.
      let shouldRunGitAfterArchive: boolean | undefined;
      if (stage === "archive" && nextStageAfter(sequence, index + 1) === "git") {
        try {
          shouldRunGitAfterArchive = await this.shouldRunGitStage(cwd, changeName);
        } catch (error) {
          yield failedEvent(runId, error instanceof Error ? error.message : String(error));
          return;
        }
      }

      // Announced only once every check that could refuse this stage has
      // passed, so "announced" always means "actually ran". A stage
      // refused at the budget ceiling above returns before reaching here
      // and is never announced as started — a display that showed it
      // would be naming a stage that spent nothing.
      const priorAttempts = state.attemptsByStage.get(stage) ?? 0;
      yield {
        kind: "stageStarted",
        runId,
        timestamp: nowIso(),
        stage,
        // "" for the stages that run no agent at all ("archive", "git"),
        // matching `checkpoint`'s `nextAgentId` convention rather than
        // inventing a second spelling for the same idea.
        agentId: !isHarnessStepAgentStage(stage)
          ? ""
          : (harnessConfig.stepAgents[stage] === undefined
            ? ""
            : normalizeStepAgent(harnessConfig.stepAgents[stage]).agent),
        // Absent on a first attempt, which is every chain that has not
        // come back here — a surface renders those exactly as it always
        // did.
        ...(priorAttempts > 0 ? { attempt: priorAttempts + 1 } : {}),
        ...(state.returnReason !== undefined ? { previousAttemptReason: state.returnReason } : {}),
      };
      state.returnReason = undefined;

      const applyCheckpoint = stage === "apply" ? await this.captureApplyCheckpoint(cwd) : undefined;

      // Unlike the budget check above, this one can act on a stage that
      // is already running: elapsed time is known during a run where a
      // run's cost is not, which is the whole reason a time ceiling
      // exists (see run-has-a-time-limit's design.md). The timer calls
      // `cancel()` rather than killing the child directly — `cancel()`
      // terminates the process tree, resolves a pending checkpoint and
      // sets the flag this loop reads, and reimplementing two of those
      // three is how a chain keeps walking after its stage was killed.
      // Absent means one attempt, which is what every chain did before
      // this setting existed. A stage is attempted again only when a
      // ceiling cut it and attempts remain — never after it failed on its
      // own merits, which retrying would only repeat.
      const maxAttempts = harnessConfig.maxStageAttempts ?? 1;
      let outcome: "completed" | "failed" | "cancelled" | "checks-failed" = "failed";
      // Read from the chain rather than started at zero: a chain that
      // returned here from `verify` has already spent attempts on this
      // stage, and a counter local to this loop would forget them.
      let attempt = state.attemptsByStage.get(stage) ?? 0;
      while (attempt < maxAttempts) {
        attempt += 1;
        state.attemptsByStage.set(stage, attempt);
        state.cancelReason = undefined;
        state.lastStageUsage = undefined;
        const stageStartedAt = Date.now();
        const stageDeadlineMs = this.stageDeadlineMs(harnessConfig, state);
        const stageTimer = stageDeadlineMs === undefined
          ? undefined
          : setTimeout(() => {
            state.cancelReason = describeTimeout(harnessConfig, state, stage);
            this.cancel(runId);
          }, stageDeadlineMs);

        try {
          outcome = yield* this.runStage(stage, hasNextStage, harnessConfig, command, state, verifiedDelta);
        } finally {
          if (stageTimer) clearTimeout(stageTimer);
          // Added whether the stage completed, failed or was cut: all
          // three spent the time, and a ceiling that forgave the attempts
          // it cut would let a chain retry its way past the very ceiling
          // it was given.
          state.elapsedMs += Date.now() - stageStartedAt;
        }

        const cutByCeiling = outcome === "cancelled" && state.cancelReason !== undefined;
        if (!cutByCeiling) break;
        // The chain's own cancel flag was set by the timer calling
        // `cancel()`; clearing it is what makes a further attempt
        // possible, and it is cleared only on this path — a person's
        // cancel leaves it set and ends the chain.
        state.cancelRequested = false;
        if (attempt >= maxAttempts) {
          yield {
            kind: "cancelled",
            runId,
            timestamp: nowIso(),
            reason: `stopped "${stage}" after ${attempt} attempt(s), the maximum configured`
              + ` (maxStageAttempts: ${maxAttempts}); the last ended because it was ${state.cancelReason}`,
          };
          return;
        }
        yield {
          kind: "stageStarted",
          runId,
          timestamp: nowIso(),
          stage,
          agentId: !isHarnessStepAgentStage(stage)
            ? ""
            : (harnessConfig.stepAgents[stage] === undefined
              ? ""
              : normalizeStepAgent(harnessConfig.stepAgents[stage]).agent),
          attempt: attempt + 1,
          previousAttemptReason: state.cancelReason,
        };
      }

      // Checked after the stage, never during it: a run's cost is not
      // known until it ends, so this stops the chain rather than the
      // stage. The ceiling that stops a stage mid-run is `timeout`.
      const stageSpendReason = describeStageOverspend(harnessConfig, state.lastStageUsage, stage);
      if (stageSpendReason) {
        yield failedEvent(runId, stageSpendReason);
        return;
      }

      if (stage === "apply" && applyCheckpoint && outcome === "completed") {
        verifiedDelta = await this.finalizeApplyCheckpoint(applyCheckpoint);
      }

      // A failing mechanical check at `verify` is the clearest statement
      // this chain can produce that earlier work is unfinished, so it
      // takes the same backward edge an unchecked task does. The gate
      // that produced it deliberately did not invoke the verifying agent,
      // and returning to `apply` spends no verifying run either — the
      // gate's reason for existing is preserved, not traded away.
      if (outcome === "checks-failed") {
        const summary = state.checkFailureSummary ?? "";
        state.checkFailureSummary = undefined;
        const applyIndex = sequence.findIndex((item) => item.kind === "stage" && item.stage === "apply");
        const applyMaxAttempts = harnessConfig.maxStageAttempts ?? 1;
        const applyAttempts = state.attemptsByStage.get("apply") ?? 0;
        // The same guard, for the same reason, as the unchecked-task edge
        // below: nothing configured means one attempt, which means no
        // return is possible, and then this must behave exactly as it did
        // before a return existed.
        const canReturn = applyIndex !== -1 && applyMaxAttempts > 1 && applyAttempts < applyMaxAttempts;
        if (!canReturn) {
          yield failedEvent(runId, `mechanical checks failed, verifying agent was not invoked: ${summary}`);
          return;
        }
        state.returnReason = `mechanical checks failed, verifying agent was not invoked: ${summary}`;
        index = applyIndex - 1; // the loop's own increment moves it to `apply`
        continue;
      }

      if (outcome !== "completed") return;

      // The one backward edge in an otherwise forward-only chain, and it
      // exists because `verify` is the only stage that produces a
      // machine-checked statement that earlier work is unfinished: it
      // writes each declared check's result onto that task's own
      // checkbox, so a failing check unchecks the task. Walking on to
      // `archive` from here means being refused by it — the chain would
      // detect unfinished work correctly and then stop with an error
      // instead of finishing it.
      if (stage === "verify") {
        const applyIndex = sequence.findIndex((item) => item.kind === "stage" && item.stage === "apply");
        const tasks = await countTasks(context.changeDir);
        const applyMaxAttempts = harnessConfig.maxStageAttempts ?? 1;
        // Nothing configured means one attempt, which means no return is
        // possible — and then this must stay out of the way entirely, so
        // `archive` refuses exactly as it always has. Reporting a
        // different failure here would change what every existing
        // configuration does, which is the regression this guard prevents.
        if (tasks && tasks.unchecked > 0 && applyMaxAttempts > 1) {
          const applyAttempts = state.attemptsByStage.get("apply") ?? 0;
          const unfinished = await unfinishedTaskTexts(cwd, changeName);
          if (applyIndex === -1 || applyAttempts >= applyMaxAttempts) {
            // Named, not counted. The reader is about to take this over,
            // and `archive`'s own refusal already tells them how many —
            // which of them is what costs a file to find out.
            yield failedEvent(
              runId,
              applyIndex === -1
                ? `verification left ${tasks.unchecked} task(s) unchecked, and this chain did not run "apply"`
                  + ` to send them back to: ${unfinished}`
                : `verification left ${tasks.unchecked} task(s) unchecked after "apply" used all`
                  + ` ${applyMaxAttempts} of its attempts: ${unfinished}`,
            );
            return;
          }
          state.returnReason = `verification left ${tasks.unchecked} task(s) unchecked`;
          index = applyIndex - 1; // the loop's own increment moves it to `apply`
          continue;
        }
      }
      if (!hasNextStage) return;

      if (stage === "archive") {
        archivedSummary = `archived ${changeName}`;
        if (nextStageAfter(sequence, index + 1) === "git" && !shouldRunGitAfterArchive) {
          // Ending here is right when `git` is all that remains, which is
          // every chain that declares no step after `archive`. Where a
          // declared step does remain, only the git stage is skipped —
          // returning would silently drop a step the change asked for,
          // which is the "setting nothing reads" this project refuses.
          if (!sequence.slice(index + 1).some((later) => later.kind === "step")) {
            yield { kind: "completed", runId, timestamp: nowIso(), summary: archivedSummary };
            return;
          }
          gitStageSkipped = true;
        }
      }

      if (state.cancelRequested) {
        yield { kind: "cancelled", runId, timestamp: nowIso(), ...(state.cancelReason ? { reason: state.cancelReason } : {}) };
        return;
      }

      // Names the next PART, step or stage alike: a chain that announced
      // "next: archive" while a declared wait stood between them would be
      // describing a sequence it is not about to run.
      const nextEntry = sequence[index + 1];
      // Unreachable: `hasNextStage` above already returned otherwise.
      if (nextEntry === undefined) return;
      const nextStage = nextEntry.kind === "stage" ? nextEntry.stage : nextEntry.declaration.step;
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
          yield { kind: "cancelled", runId, timestamp: nowIso(), ...(state.cancelReason ? { reason: state.cancelReason } : {}) };
          return;
        }
      } else {
        yield { kind: "stageCompleted", runId, timestamp: nowIso(), stage, nextStage };
      }
    }

    // Reached only when the last part of the sequence was a declared step
    // (ADR 0021): a stage that is last returns out of the loop above,
    // having yielded its own terminal event. A step does not, because it
    // is not the thing whose completion the chain reports — so without
    // this, a chain ending in a step would end with no terminal event at
    // all, and every consumer would be left waiting on a run that had
    // finished.
    yield {
      kind: "completed",
      runId,
      timestamp: nowIso(),
      summary: archivedSummary ?? `finished ${changeName}`,
    };
  }

  /** Returns a failure reason naming the budget, or `undefined` when the
   * stage is free to start. `undefined` whenever there is nothing to
   * check against: no `budget` configured, no `listAuditEntries`
   * dependency supplied, or no recorded usage yet for this change — see
   * spec.md, "A configured budget stops work at stage boundaries" and
   * task 8.5 (runs with no `usage` contribute nothing to the total, so a
   * change whose runs are all unmeasured never trips the ceiling). */
  /** Milliseconds until the running stage must be cut, or `undefined`
   * when nothing bounds it. The smaller of the stage ceiling and what is
   * left of the run ceiling — whichever would fire first is the one that
   * does, so a stage never outlives the chain's own limit. */
  private stageDeadlineMs(config: HarnessConfig, state: ChainState): number | undefined {
    const candidates: number[] = [];
    const stageSeconds = config.timeout?.maxStageSeconds;
    if (stageSeconds !== undefined) candidates.push(stageSeconds * 1000);
    const runSeconds = config.timeout?.maxRunSeconds;
    if (runSeconds !== undefined) candidates.push(Math.max(0, runSeconds * 1000 - state.elapsedMs));
    return candidates.length === 0 ? undefined : Math.min(...candidates);
  }

  private async checkBudget(harnessConfig: HarnessConfig, changeDir: string): Promise<string | undefined> {
    const budget = harnessConfig.budget;
    if (!budget || (budget.maxCostUsd === undefined && budget.maxTokens === undefined)) return undefined;
    if (!this.deps.listAuditEntries) return undefined;

    const entries = await this.deps.listAuditEntries();
    const total = totalForChange(buildUsageReport(entries).totalsByChange, changeDir);
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
  ): AsyncGenerator<Event, "completed" | "failed" | "cancelled" | "checks-failed"> {
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
        // Recorded before the gate below, which returns without invoking
        // the verifying agent — so the failing case, which records
        // nothing today, is exactly the one this must not miss.
        this.recordVerifyChecks(command, verifyCheckOutcome, harnessConfig);
      } catch (error) {
        yield failedEvent(runId, error instanceof Error ? error.message : String(error));
        return "failed";
      }
      if (verifyCheckOutcome.failed.length > 0) {
        // Recorded, not reported. A failing check is the clearest
        // statement this chain can produce that earlier work is
        // unfinished — it is what unchecks the task in the first place —
        // so where another `apply` attempt is available the work goes
        // back rather than the chain ending. Only the loop knows whether
        // one is, so it yields the event: see verify-sends-work-back tasks.md section 6.
        state.checkFailureSummary = verifyCheckOutcome.failed
          .map((entry) => `${entry.check.name}${entry.check.param ? `(${entry.check.param})` : ""}: ${entry.result.reason}`)
          .join("; ");
        return "checks-failed";
      }
    }

    const stepAgent = harnessConfig.stepAgents[stage];
    const { agent: agentId, model, effort, budget, customAgent } = stepAgent === undefined
      ? { agent: undefined, model: undefined, effort: undefined, budget: undefined, customAgent: undefined }
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
    // `stage` travels beside `model`/`effort`/`budget`, which the chain
    // already sets here — it is what lets an audit entry say which stage
    // spent what, since every stage runs under the chain's own runId.
    const stageCommand: Command = { kind: CHAIN_STAGE_COMMAND[stage], cwd, context: stageContext, runId, agentId, model, effort, budget, customAgent, stage };
    state.currentRunner = runner;
    state.currentCommand = stageCommand;

    // Set once a permission request has been intercepted under
    // `"autonomous"` (task 4.1) — from that point on, the stage's own
    // `"failed"`/`"cancelled"` terminal events are suppressed, so the
    // chain reports the one outcome this interception already yielded,
    // not a `"failed"` followed by the `"cancelled"` produced by ending
    // the process below (see design.md, "Under autonomous, the stage
    // fails and the process is ended", step 4).
    let autonomousPermissionFailure = false;
    let outcome: "completed" | "failed" | "cancelled" = "completed";
    try {
      for await (const event of runner.run(stageCommand)) {
        if (event.kind === "permissionRequest" && harnessConfig.autonomyLevel === "autonomous" && !autonomousPermissionFailure) {
          autonomousPermissionFailure = true;
          outcome = "failed";
          yield event;
          yield failedEvent(
            runId,
            `a permission request cannot be answered under autonomyLevel "autonomous": ${event.description}`,
          );
          // Ends the stage's process rather than abandoning the generator
          // (the rejected alternative in design.md) — `break`ing here would
          // leave the ACP driver's permission handler parked on a promise
          // nobody can resolve, and the CLI subprocess would outlive the
          // chain.
          const cancelCommand: Command = { ...stageCommand, kind: "cancel" };
          void (async () => {
            try {
              for await (const _event of runner.run(cancelCommand)) {
                // Draining only — same shape as `cancel()`/`resolvePermission()`.
              }
            } catch {
              // Must not become an unhandled rejection.
            }
          })();
          continue;
        }
        if (autonomousPermissionFailure) continue;
        if (event.kind === "completed") {
          outcome = "completed";
          if (hasNextStage) continue;
          yield event;
          continue;
        }
        if (event.kind === "usageReported") state.lastStageUsage = event.usage;
        if (event.kind === "failed") outcome = "failed";
        if (event.kind === "cancelled") {
          outcome = "cancelled";
          // The runner reports that its process is gone; only the chain
          // knows a rule caused that rather than a person, so the reason
          // is attached here rather than invented downstream.
          yield state.cancelReason ? { ...event, reason: state.cancelReason } : event;
          continue;
        }
        yield event;
      }
    } finally {
      state.currentRunner = undefined;
      state.currentCommand = undefined;
    }
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

  /** Runs one declared step, reporting it on the chain's own timeline.
   * Returns `false` when the chain must stop.
   *
   * The time a waiting step spends is deliberately NOT added to
   * `state.elapsedMs`: a chain waiting for something outside itself is
   * not consuming anything, exactly as a chain paused at a checkpoint is
   * not, and counting it would fire the run-time ceiling on chains
   * behaving exactly as they were configured. Each wait carries its own
   * maximum duration instead, so a chain still never waits forever. */
  private async *runDeclaredStep(
    declaration: HarnessChainStep,
    command: Command,
    state: ChainState,
    changeName: string,
  ): AsyncGenerator<Event, boolean> {
    const { runId, cwd } = command;
    yield {
      kind: "stageStarted",
      runId,
      timestamp: nowIso(),
      // A step names itself in the field a stage names itself in — one
      // timeline, so a surface that renders stages renders this with no
      // new event kind to learn.
      stage: declaration.step,
      // The convention `archive` and `git` already use for a part of the
      // chain that invokes no agent, rather than a second spelling.
      agentId: "",
    };

    const startedAt = Date.now();
    let result;
    try {
      result = await runChainStep(declaration.step, declaration.param, {
        workspaceRoot: cwd,
        changeName,
        maxWaitMs: declaration.maxWaitSeconds !== undefined
          ? declaration.maxWaitSeconds * 1000
          : DEFAULT_CHAIN_STEP_MAX_WAIT_MS,
      });
    } catch (error) {
      yield failedEvent(runId, `step "${declaration.step}" failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }

    if (!isWaitingStep(declaration.step)) {
      state.elapsedMs += Date.now() - startedAt;
    }

    if (!result.ok) {
      yield failedEvent(runId, `step "${declaration.step}" did not succeed: ${result.reason}`);
      return false;
    }

    yield { kind: "progress", runId, timestamp: nowIso(), message: `${declaration.step}: ${result.reason}` };
    return true;
  }

  /** Records what `verify`'s declared checks found.
   *
   * Written by this runner rather than by an agent run, for the reason
   * `recordGitAction` exists: mechanical work that no agent performed
   * still belongs in the record. And it matters most in the case that
   * records nothing today — a `verify` whose checks failed never invokes
   * the verifying agent, so the run that found the most left no trace.
   *
   * A change declaring no checks records nothing at all: an entry saying
   * none ran is indistinguishable from one saying none failed.
   *
   * `agent` names the writer, which is this runner — so the entry also
   * carries `checkedAgent`, the agent whose work these checks examined.
   * Without it the only thing a per-agent readback could group by was
   * the pseudo-agent, and it produced one row naming nobody however many
   * agents had run. See
   * quality-is-charged-to-the-agent-whose-work-was-checked. */
  private recordVerifyChecks(
    command: Command,
    outcome: MechanicalCheckRunOutcome,
    harnessConfig: HarnessConfig,
  ): void {
    if (!outcome.ranAny) return;
    const failures = outcome.failed
      .map((entry) => `${entry.check.name}${entry.check.param ? `(${entry.check.param})` : ""}: ${entry.result.reason}`)
      .join("; ");
    this.deps.auditLog?.record({
      runId: command.runId,
      agent: VERIFY_CHECKS_AGENT_NAME,
      outcome: outcome.failed.length === 0 ? "completed" : "failed",
      cwd: command.cwd,
      timestamp: nowIso(),
      changeDir: command.context.changeDir,
      stage: "verify",
      checkedAgent: resolvedApplyAgent(harnessConfig),
      checksRan: outcome.passed.length + outcome.failed.length,
      checksFailed: outcome.failed.length,
      ...(failures.length > 0 ? { reason: failures } : {}),
    });
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
