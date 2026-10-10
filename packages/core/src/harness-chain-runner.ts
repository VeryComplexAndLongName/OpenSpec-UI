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
import { runStartStage } from "./run-plan.js";
import path from "node:path";
import { describeContextShare, formatTokenCount, readAcpContextGauge } from "./acp-context-gauge.js";
import { readAcpStreamedText } from "./acp-streamed-text.js";
import type { AdapterInvocation, AgentRunner } from "./agent-runner.js";
import { captureCheckpoint, finalizeCheckpoint, type WorkbenchCheckpoint } from "./checkpoint.js";
import {
  buildGhPrCreateInvocation,
  buildGhPrMergeInvocation,
  buildGitPushInvocation,
  createPullRequestGateway,
  type PullRequestGateway,
} from "./gh-pr-gateway.js";
import { pullRequestGatewayFor } from "./forge.js";
import { commitWhatIsLeft } from "./change-commit.js";
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
  resolveSupervisor,
} from "./harness-config.js";
import { archiveChange, statusChange } from "./openspec.js";
import {
  DEFAULT_CHAIN_STEP_MAX_WAIT_MS,
  isWaitingStep,
  runChainStep,
} from "./chain-steps.js";
import { CHAIN_ENDING_AGENT_NAME, SUPERVISOR_AGENT_NAME, VERIFY_CHECKS_AGENT_NAME } from "./audit-runs.js";
import { superviseFailure } from "./supervisor.js";
import { isChainStepName, skipsStage, type ChainPart } from "./harness-stage.js";
import { untilStopBoundary } from "./stop-boundary.js";
import { DEFAULT_AGENT_ID } from "./agents/registry.js";
import { checkAllowlist, type AllowlistConfig, type AuditEntry, type AuditLog } from "./security.js";
import type { AgentUsage } from "./agent-usage.js";
import { readTaskChecklist, TASK_CHECKBOX_LINE_RE, writeTaskCheckStates } from "./task-checklist.js";
import { buildUsageReport, unitKey, type UsageTotal } from "./usage-report.js";
import { say, type SaidMessage } from "./message-register.js";

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
   * responsibility, not the chain runner's. `cwd` is where the stage runs:
   * a host gives a change's own worktree that worktree's agents, whose
   * sandbox is that worktree (a-change-runs-in-its-own-worktree). */
  resolveRunner: (agentId: string | undefined, cwd?: string) => AgentRunner | undefined;
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
  /** Writes the answer to a question the operator asked, once the stage
   * that carried it has ended. The chain holds no key and signs nothing:
   * the host that reads messages is the one that has the key, and it
   * passes this in (the-operator-can-say-something-to-a-run). Absent, a
   * question is delivered and the answer is left unwritten, which the
   * audit says. */
  answerMessage?: (answer: ChainAnswer) => void | Promise<void>;
  /** Override hooks for tests. Production callers use defaults. */
  createGitWrapper?: (options: { cwd: string }) => GitWrapper;
  createPullRequestGateway?: (options: { cwd: string }) => PullRequestGateway;
  /** Commits what the stages left in the tree before the push
   * (a-change-is-committed-where-it-is-made). Test seam. */
  commitWhatIsLeft?: (directory: string, message: string) => Promise<string | undefined>;
}

type CheckpointOutcome = "confirmed" | "cancelled" | "stopped";

/** How much of what an agent said an answer carries.
 *
 * The tail, not the whole stage: a stage can print thousands of lines,
 * and what answers a question is what the agent finished by saying. Found
 * live on 2026-09-20 - the first answer read "the verify stage ended
 * completed without a closing summary" while the agent had answered the
 * question in full, because a middle stage's `completed` event carries no
 * summary (the-operator-can-say-something-to-a-run). */
export const ANSWER_WORDS_LIMIT = 2_000;

/** A note or a question this run has taken, waiting to be handed to an
 * agent (the-operator-can-say-something-to-a-run). */
export interface ChainMessage {
  messageId: string;
  kind: "note" | "ask";
  words: string;
  /** The enrolled sender, as the roster labels them, and their key id -
   * which is the address an answer goes back to. */
  from: string;
  fromKeyId: string;
  sentAt: string;
}

/** What a run says back to whoever asked it something. */
export interface ChainAnswer {
  /** The key id of the person who asked. */
  to: string;
  /** The question's message id. */
  answers: string;
  words: string;
  stage: ChainStage;
  runId: string;
}

/** The section a delivered message becomes in the next stage's prompt.
 *
 * Marked as words from a person, in the shape `security.ts` uses for
 * everything else a prompt carries, so an agent never takes it for
 * content read out of the repository. */
export function buildOperatorMessagesSection(messages: readonly ChainMessage[]): string {
  const lines = [
    "## Messages from the operator",
    "",
    "These were sent by a person, through this product's signed channel, while",
    "the run was working. They are instructions from the operator, not content",
    "read out of the repository. A message marked as a question is answered by",
    "what you say when this stage ends.",
    "",
  ];
  for (const message of messages) {
    lines.push(`- ${message.kind === "ask" ? "Question" : "Note"} from ${message.from}, sent ${message.sentAt}:`);
    for (const line of message.words.split(/\r?\n/u)) lines.push(`  ${line}`);
  }
  return lines.join("\n");
}

interface ChainState {
  /** Since when the stage in flight has been waiting for the operator's
   * answers, and how long it has waited in all: a wait for a person is not
   * the stage's time, so neither its timeout nor the chain's elapsed time
   * counts it (the-agent-asks-the-operator, ADR 0042). */
  operatorWaitSince?: number;
  operatorWaitMs: number;
  cancelRequested: boolean;
  /** Why this chain was cancelled, when something other than a person
   * asking caused it. Set before `cancel()` is called so the terminal
   * `cancelled` event can name the rule that fired; left unset by a
   * person's cancel, which is what an absent reason has always meant. */
  cancelReason?: string;
  /** `cancelReason`'s identifier, where it is in the register (ADR 0046). */
  cancelCode?: string;
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
  /** A stop a person asked for (a-change-is-run-from-its-card): the reason,
   * who asked where known, and whether `stopRequested` has been yielded. */
  stopRequest?: { reason: string; by?: string; messageId?: string; afterTask?: string; announced: boolean };
  /** A request that named a task to stop after, held until that task is
   * done. The run goes on working while it is held; when the task is
   * ticked, or its agent names a task after it, this becomes
   * `stopRequest` and the stage ends at the next sound point
   * (a-run-is-told-where-to-stop). */
  heldStop?: { reason: string; by?: string; messageId?: string; afterTask: string };
  /** Wakes the running stage's stop boundary, so a stop is acted on while
   * the stage says nothing. */
  stopWake?: () => void;
  /** Notes and questions taken from the signed channel and not yet handed
   * to an agent. They are handed over when the next stage starts: an agent
   * reads its prompt when its stage begins, and there is no second way in
   * (the-operator-can-say-something-to-a-run). */
  pendingMessages: ChainMessage[];
  /** The questions handed to the stage now running, waiting for what it
   * says at its end. */
  awaitingAnswer: ChainMessage[];
  /** The `failed` event a stage's agent ended with, held by `runStage` until
   * the attempt loop decides whether the supervisor repeats or moves the
   * stage. Yielded unchanged where it does not, so a `failed` event is
   * still the last of the chain it ends (ADR 0012), and never yielded for a
   * stage that goes on (the-supervisor-changes-agents). */
  heldFailure?: Extract<Event, { kind: "failed" }>;
  /** The agent the supervisor moved a stage to, which later attempts of it
   * run on. */
  agentOverride: Map<ChainStage, string>;
  /** Every agent each stage has run on in this chain: a fallback is never
   * tried twice. */
  triedAgents: Map<ChainStage, string[]>;
  /** What the chain's review said of the plan, until the update it asks
   * for has run (ADR 0041). */
  reviewVerdict?: "ready" | "changes-needed";
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Runs a request about a run — a cancel, a permission's answer — to its
 * end without waiting on it. A runner that throws on one must not become an
 * unhandled rejection. */
function drainInBackground(events: AsyncIterable<Event>): void {
  void (async () => {
    try {
      for await (const _event of events) {
        // Draining only: the stage's own open stream is what reports.
      }
    } catch {
      // See above.
    }
  })();
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
): SaidMessage | undefined {
  if (!usage) return undefined;
  const maxCostUsd = config.budget?.maxStageCostUsd;
  if (maxCostUsd !== undefined && usage.costUsd !== undefined && usage.costUsd > maxCostUsd) {
    return say("OSW-RUN-204", { stage, spent: usage.costUsd.toFixed(2), ceiling: maxCostUsd.toFixed(2) });
  }
  const maxTokens = config.budget?.maxStageTokens;
  if (maxTokens !== undefined) {
    const used = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
    if ((usage.inputTokens !== undefined || usage.outputTokens !== undefined) && used > maxTokens) {
      // Explicitly grouped: a bare `toLocaleString` made this one line of
      // text read two ways, by whose machine wrote it.
      return say("OSW-RUN-205", { stage, spent: formatTokenCount(used), ceiling: formatTokenCount(maxTokens) });
    }
  }
  return undefined;
}

/** Names the ceiling that fired and the value it was set to, rather than
 * blaming the stage that happened to be running — the posture
 * `checkBudget` already takes when it stops a chain. */
function describeTimeout(config: HarnessConfig, state: ChainState, stage: ChainStage): SaidMessage {
  const runSeconds = config.timeout?.maxRunSeconds;
  const stageSeconds = config.timeout?.maxStageSeconds;
  const remainingRunMs = runSeconds === undefined ? undefined : Math.max(0, runSeconds * 1000 - state.elapsedMs);
  const stageMs = stageSeconds === undefined ? undefined : stageSeconds * 1000;
  const runFiredFirst = remainingRunMs !== undefined && (stageMs === undefined || remainingRunMs <= stageMs);
  if (runFiredFirst) {
    return say("OSW-RUN-207", { seconds: String(runSeconds), spent: formatSeconds(state.elapsedMs), stage });
  }
  return say("OSW-RUN-208", { stage, seconds: String(stageSeconds) });
}

function changeNameFromDir(changeDir: string): string {
  const segments = changeDir.split(/[\\/]+/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? "";
}

/** A failure, with its identifier where the reason is in the register
 * (ADR 0046). */
function failedEvent(runId: string, reason: string | SaidMessage): Event {
  return typeof reason === "string"
    ? { kind: "failed", runId, timestamp: nowIso(), reason }
    : { kind: "failed", runId, timestamp: nowIso(), reason: reason.text, code: reason.code };
}

/** A cancellation's reason and identifier, where a rule caused it rather
 * than a person. */
function cancelledBy(state: ChainState): { reason?: string; code?: string } {
  if (!state.cancelReason) return {};
  return { reason: state.cancelReason, ...(state.cancelCode !== undefined ? { code: state.cancelCode } : {}) };
}

/** Which agent this chain's `apply` stage runs as — the agent whose work
 * a later `verify` stage's checks examine.
 *
 * An unset `apply` entry falls back to `DEFAULT_AGENT_ID`, which is the
 * same fallback `resolveRunner` applies (`default-runners.ts`), so the
 * name recorded here matches the `agent` the apply stage's own audit
 * entries carry and the two group together. */
function resolvedApplyAgent(harnessConfig: HarnessConfig, state?: Pick<ChainState, "agentOverride">): string {
  const moved = state?.agentOverride.get("apply");
  if (moved !== undefined) return moved;
  const entry = harnessConfig.stepAgents.apply;
  return entry === undefined ? DEFAULT_AGENT_ID : normalizeStepAgent(entry).agent;
}

/** The agent a stage runs on in this chain, as `stageStarted` and
 * `checkpoint` name it: the one the supervisor moved it to, else its
 * configured entry, else "" — for a stage with no agent, or none
 * configured (the-supervisor-changes-agents). */
function stageAgentOf(stage: ChainPart, harnessConfig: HarnessConfig, state: Pick<ChainState, "agentOverride">): string {
  if (isChainStepName(stage) || !isHarnessStepAgentStage(stage)) return "";
  const moved = state.agentOverride.get(stage);
  if (moved !== undefined) return moved;
  const entry = harnessConfig.stepAgents[stage];
  return entry === undefined ? "" : normalizeStepAgent(entry).agent;
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

/** A line for an implementing run that changed files and ticked no task,
 * or `undefined` when it ticked one, changed nothing, or either count
 * could not be read.
 *
 * Reported, never refused. The work may be fine and the ticks merely
 * missing — which verification may now repair by ticking what it confirms
 * — and refusing would stop exactly the chain that could finish. What
 * this prevents is the silence: on 2026-09-12 an implementing run did its
 * work, ended with nothing ticked, and nothing on the chain's timeline
 * said so. See openspec/changes/a-done-task-is-ticked/design.md. */
async function describeApplyThatTickedNothing(
  before: TaskCounts | undefined,
  changeDir: string,
  delta: VerifiedDeltaEntry[] | undefined,
): Promise<SaidMessage | undefined> {
  if (!before || !delta || delta.length === 0) return undefined;
  const after = await countTasks(changeDir);
  if (!after) return undefined;
  const tickedBefore = before.total - before.unchecked;
  const tickedAfter = after.total - after.unchecked;
  if (tickedAfter > tickedBefore) return undefined;
  return say("OSW-RUN-103", { count: delta.length });
}

/** The reason a chain ends after an implementing run that did nothing: it
 * changed no file and ticked no task, while a task it could do - not
 * Human-only, not delegated - is still open. `undefined` where it ticked
 * one, where nothing is left for it to do, or where the task list could not
 * be read.
 *
 * Only ever asked of a checkpoint that was read and held no change: an
 * unread one decides nothing. On 2026-10-08 two chains went on from such a
 * run to `verify`, which had nothing to confirm, and to `archive`, which
 * refused, and the reason they stopped was said nowhere. See
 * openspec/changes/an-apply-that-ticks-nothing-ends-the-chain/design.md. */
async function describeApplyThatDidNothing(
  before: TaskCounts | undefined,
  changeDir: string,
  workspaceRoot: string,
  changeName: string,
): Promise<SaidMessage | undefined> {
  if (!before) return undefined;
  const after = await countTasks(changeDir);
  if (!after) return undefined;
  if (after.total - after.unchecked > before.total - before.unchecked) return undefined;
  let items;
  try {
    items = await readTaskChecklist(workspaceRoot, changeName, false);
  } catch {
    return undefined;
  }
  // A person's task, or another agent's, is not this stage's to do.
  const its = items.filter((item) => !item.done && item.humanOnly !== true && item.delegatedTo === undefined);
  if (its.length === 0) return undefined;
  const shown = its.slice(0, 5).map((item) => `"${item.text}"`).join(", ");
  const more = its.length > 5 ? `, and ${its.length - 5} more` : "";
  return say("OSW-RUN-104", { count: its.length, tasks: `${shown}${more}` });
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
  // found during a run, and `openspec-ui-cli run checks` — which asks the same
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
  if (!proposeDone) return runStartStage({ proposeDone });
  const tasks = await countTasks(changeDir);
  // The same decision the run dialog states (the-run-dialog-says-where-it-
  // starts): one function, so the dialog cannot name one stage and the run
  // begin at another.
  return runStartStage({ proposeDone, ...(tasks ? { openTasks: tasks.unchecked } : {}) });
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
/** Two per-unit totals, added unit by unit. */
function mergeCostByUnit(
  left: Record<string, number>,
  right: Record<string, number>,
): Record<string, number> {
  const merged: Record<string, number> = { ...left };
  for (const [unit, amount] of Object.entries(right)) {
    merged[unit] = (merged[unit] ?? 0) + amount;
  }
  return merged;
}

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
        // Per unit, never across: a credit and a euro are not addends
        // (a-run-budget-has-a-unit).
        costByUnit: mergeCostByUnit(found.costByUnit, total.costByUnit),
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
      yield failedEvent(command.runId, say("OSW-RUN-004", { kind: command.kind }));
      return;
    }

    const state: ChainState = {
      cancelRequested: false,
      elapsedMs: 0,
      operatorWaitMs: 0,
      attemptsByStage: new Map(),
      pendingMessages: [],
      awaitingAnswer: [],
      agentOverride: new Map(),
      triedAgents: new Map(),
    };
    this.active.set(command.runId, state);
    // The stage the chain is in, and how it ended, as its own events say.
    // Read here rather than at each place an ending is yielded, so no
    // ending — a cancel at a checkpoint, a limit, a failure — goes
    // unrecorded (a-card-says-what-its-change-is-doing).
    let stage: ChainPart | undefined;
    let ending: Extract<Event, { kind: "completed" | "failed" | "cancelled" }> | undefined;
    try {
      for await (const event of this.runChain(command, state)) {
        if (event.kind === "stageStarted") stage = event.stage;
        if (event.kind === "completed" || event.kind === "failed" || event.kind === "cancelled") ending = event;
        yield event;
      }
    } finally {
      this.active.delete(command.runId);
      if (ending !== undefined) this.recordEnding(command, ending, stage, state.stopRequest);
    }
  }

  /** The one entry a chain writes as it ends: how, at which stage, and why.
   * It carries no usage — the stages' own entries do — and `isRunEntry`
   * skips it, so no counter reads it as a run.
   *
   * A chain a person asked to stop carries that request as `stopRequest`,
   * and no `reason`: a reason on a cancellation means a rule fired
   * (a-change-is-run-from-its-card). */
  private recordEnding(
    command: Command,
    ending: Extract<Event, { kind: "completed" | "failed" | "cancelled" }>,
    stage: ChainPart | undefined,
    stopRequest: ChainState["stopRequest"],
  ): void {
    const stopped = ending.kind === "cancelled" && stopRequest !== undefined
      ? {
        reason: stopRequest.reason,
        ...(stopRequest.by !== undefined ? { by: stopRequest.by } : {}),
        // The request a run elsewhere acted on (a-run-elsewhere-can-be-asked-to-stop).
        ...(stopRequest.messageId !== undefined ? { messageId: stopRequest.messageId } : {}),
        // The task the request named, so a line read a week later says
        // where the run was told to stop rather than where it happened to
        // (a-run-is-told-where-to-stop).
        ...(stopRequest.afterTask !== undefined ? { afterTask: stopRequest.afterTask } : {}),
      }
      : undefined;
    const reason = ending.kind === "completed" || stopped !== undefined ? undefined : ending.reason;
    this.deps.auditLog?.record({
      runId: command.runId,
      agent: CHAIN_ENDING_AGENT_NAME,
      outcome: ending.kind,
      cwd: command.cwd,
      timestamp: Number.isFinite(Date.parse(ending.timestamp)) ? ending.timestamp : nowIso(),
      changeDir: command.context.changeDir,
      // A declared step is not a stage the audit log names.
      ...(stage !== undefined && !isChainStepName(stage) ? { stage } : {}),
      ...(reason !== undefined ? { reason } : {}),
      // The failed stage's own diagnosis, which the stage's failure carried
      // through to here: the last-run reading prefers this entry, so a
      // diagnosis left on the stage's entry alone would not reach a card
      // (the-supervisor-advises).
      ...(ending.kind === "failed" && ending.diagnosis !== undefined ? { diagnosis: ending.diagnosis } : {}),
      ...(stopped !== undefined ? { stopRequest: stopped } : {}),
    });
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

  /** Whether this runner holds an active chain under `runId`, so a host can
   * route a request about that run here rather than to a single-stage
   * runner that never heard of it. */
  holds(runId: string): boolean {
    return this.active.has(runId);
  }

  /** Asks a chain to stop where its work is sound, rather than killing it as
   * `cancel()` does (a-change-is-run-from-its-card, ADR 0028).
   *
   * - Waiting at a checkpoint, it ends at once.
   * - Inside a stage, the stage ends at the first of: a marker naming a task
   *   other than the last one named, the count of ticked tasks rising, or
   *   the stage's own end. A stage waiting on a permission is answered
   *   `deny` and ends at once.
   * - Between stages, no further stage starts.
   *
   * Each way yields `stopRequested` with outcome `asked` on the chain's own
   * stream, then ends `cancelled` with no reason. `by` is the host's
   * configured git identity where the caller gives none. A second request
   * while one is pending changes nothing. Returns `false` for a run this
   * runner does not have.
   *
   * `messageId` is the signed request's, where the stop was asked through
   * the channel from another worktree; the chain's ending entry carries it
   * (a-run-elsewhere-can-be-asked-to-stop). */
  /** Takes a note or a question for a run this runner has, to be handed to
   * the agent when the next stage starts.
   *
   * Held rather than delivered now: an agent reads its prompt when its
   * stage begins, and this product drives no agent that can be spoken to
   * in the middle of one. A person who needs the run to act now has a stop
   * (the-operator-can-say-something-to-a-run).
   *
   * Returns `false` for a run this runner does not have. */
  deliverMessage(runId: string, message: ChainMessage): boolean {
    const state = this.active.get(runId);
    if (!state) return false;
    if (state.pendingMessages.some((held) => held.messageId === message.messageId)) return true;
    state.pendingMessages.push(message);
    return true;
  }

  requestStop(runId: string, reason: string, by?: string, messageId?: string, afterTask?: string): boolean {
    const state = this.active.get(runId);
    if (!state) return false;
    if (state.stopRequest !== undefined) return true;
    if (afterTask !== undefined) {
      // Held, not pending: the run keeps working until the task it names
      // is done. The first held request wins, as the first stop does.
      if (state.heldStop === undefined) {
        state.heldStop = {
          reason,
          ...(by !== undefined ? { by } : {}),
          ...(messageId !== undefined ? { messageId } : {}),
          afterTask,
        };
        state.stopWake?.();
      }
      return true;
    }
    state.stopRequest = {
      reason,
      ...(by !== undefined ? { by } : {}),
      ...(messageId !== undefined ? { messageId } : {}),
      ...(afterTask !== undefined ? { afterTask } : {}),
      announced: false,
    };
    if (state.pendingCheckpoint) {
      const { resolve } = state.pendingCheckpoint;
      state.pendingCheckpoint = undefined;
      resolve("stopped");
      return true;
    }
    state.stopWake?.();
    return true;
  }

  /** A held request comes due: its task was ticked, its agent named a task
   * after it, or the change's list does not have it.
   *
   * The first two become the stop this runner already knows how to honour.
   * The third is refused and recorded, and the run goes on: a task nobody
   * can find must not silently mean "stop now", which would end a run the
   * operator meant to keep, nor "never stop", which would leave a request
   * that never lands (a-run-is-told-where-to-stop). */
  private heldStopIsDue(
    command: Command,
    state: ChainState,
    due: { task: string; why: "ticked" | "passed" | "absent" },
  ): void {
    const held = state.heldStop;
    if (held === undefined) return;
    state.heldStop = undefined;
    if (due.why === "absent") {
      this.deps.auditLog?.record({
        runId: command.runId,
        agent: CHAIN_ENDING_AGENT_NAME,
        // `message`, as the channel's other refusals are recorded: nothing
        // ran and nothing ended, something was said.
        outcome: "message",
        cwd: command.cwd,
        timestamp: nowIso(),
        changeDir: command.context.changeDir,
        reason: `a request to stop after ${due.task} named a task this change does not have; the run goes on`,
      });
      return;
    }
    this.requestStop(command.runId, held.reason, held.by, held.messageId);
    const request = state.stopRequest;
    if (request !== undefined) request.afterTask = held.afterTask;
  }

  /** Yields the one `stopRequested` a requested stop produces, the first
   * time it is asked to; after that, nothing. */
  private async *announceStop(command: Command, state: ChainState): AsyncGenerator<Event> {
    const stop = state.stopRequest;
    if (stop === undefined || stop.announced) return;
    stop.announced = true;
    if (stop.by === undefined) {
      try {
        const identity = await (this.deps.createGitWrapper ?? createGitWrapper)({ cwd: command.cwd }).configuredIdentity();
        if (identity) stop.by = identity;
      } catch {
        // No identity is attribution missing, not a reason to refuse a stop.
      }
    }
    yield {
      kind: "stopRequested",
      runId: command.runId,
      timestamp: nowIso(),
      reason: stop.reason,
      ...(stop.by !== undefined ? { by: stop.by } : {}),
      outcome: "asked",
    };
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
        if (command.kind === "stop") {
          // A run this runner has announces its stop on the chain's own
          // stream, which the status record and the host that sent this
          // already read; answering here as well would say it twice. Only a
          // stop that finds no run is answered on this stream.
          const reason = command.reason ?? "";
          const known = this.requestStop(command.runId, reason);
          const runId = command.runId;
          return (async function* stopping(): AsyncGenerator<Event> {
            if (!known) yield { kind: "stopRequested", runId, timestamp: nowIso(), reason, outcome: "nothing-to-stop" };
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
      yield failedEvent(runId, say("OSW-RUN-001"));
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
      yield failedEvent(runId, say("OSW-RUN-002"));
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
        yield failedEvent(runId, say("OSW-RUN-003", { change: changeName }));
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
    // A stage `skipStages` leaves out does not run, and the timeline says
    // so, so a transcript still reads like every other
    // (a-done-change-carries-on).
    const resumed = CHAIN_STAGES.slice(CHAIN_STAGES.indexOf(startStage));
    for (const stage of resumed) {
      if (skipsStage(harnessConfig, stage)) {
        yield { kind: "progress", runId, timestamp: nowIso(), message: `${stage} skipped: skipStages leaves it out` };
      }
    }
    const sequence = insertDeclaredSteps(
      resumed.filter((stage) => !skipsStage(harnessConfig, stage)),
      harnessConfig.steps,
    );

    // Populated around the "apply" stage only (see `captureApplyCheckpoint`/
    // `readApplyCheckpoint`), and handed to the "verify" stage's own
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
        const spent = say("OSW-RUN-206", { seconds: runSeconds, spent: formatSeconds(state.elapsedMs), stage });
        yield { kind: "cancelled", runId, timestamp: nowIso(), reason: spent.text, code: spent.code };
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
        agentId: stageAgentOf(stage, harnessConfig, state),
        // Absent on a first attempt, which is every chain that has not
        // come back here — a surface renders those exactly as it always
        // did.
        ...(priorAttempts > 0 ? { attempt: priorAttempts + 1 } : {}),
        ...(state.returnReason !== undefined ? { previousAttemptReason: state.returnReason } : {}),
      };
      state.returnReason = undefined;

      const applyCheckpoint = stage === "apply" ? await this.captureApplyCheckpoint(cwd) : undefined;
      // Counted beside the checkpoint, so "did the run tick anything" is
      // asked of the same moment as "did the run change anything".
      const tasksBeforeApply = stage === "apply" ? await countTasks(context.changeDir) : undefined;

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
        state.cancelCode = undefined;
        state.lastStageUsage = undefined;
        const stageStartedAt = Date.now();
        state.operatorWaitMs = 0;
        state.operatorWaitSince = undefined;
        const stageDeadlineMs = this.stageDeadlineMs(harnessConfig, state);
        /** How long the stage has waited for the operator so far. */
        const waitedMs = () => state.operatorWaitMs + (state.operatorWaitSince === undefined ? 0 : Date.now() - state.operatorWaitSince);
        let stageTimer: ReturnType<typeof setTimeout> | undefined;
        // Measured on the stage's own time: where it waited for the
        // operator, the timer is set again for what is left (ADR 0042).
        const armStageTimer = (deadlineMs: number, inMs: number): void => {
          stageTimer = setTimeout(() => {
            const worked = Date.now() - stageStartedAt - waitedMs();
            if (worked < deadlineMs) {
              armStageTimer(deadlineMs, deadlineMs - worked);
              return;
            }
            const timedOut = describeTimeout(harnessConfig, state, stage);
            state.cancelReason = timedOut.text;
            state.cancelCode = timedOut.code;
            this.cancel(runId);
          }, inMs);
        };
        if (stageDeadlineMs !== undefined) armStageTimer(stageDeadlineMs, stageDeadlineMs);

        try {
          outcome = yield* this.runStage(stage, hasNextStage, harnessConfig, command, state, verifiedDelta);
        } finally {
          if (stageTimer) clearTimeout(stageTimer);
          // Added whether the stage completed, failed or was cut: all
          // three spent the time, and a ceiling that forgave the attempts
          // it cut would let a chain retry its way past the very ceiling
          // it was given. The time it waited for the operator is not its
          // own (ADR 0042).
          state.elapsedMs += Date.now() - stageStartedAt - waitedMs();
          state.operatorWaitSince = undefined;
        }

        // A failure from the stage's agent, which `runStage` held: under
        // `act` the supervisor may try the stage again, and otherwise it is
        // yielded here exactly as it came (the-supervisor-changes-agents).
        const held = state.heldFailure;
        state.heldFailure = undefined;
        if (held !== undefined && outcome === "failed") {
          if (yield* this.superviseHeldFailure(stage, held, harnessConfig, state, command, attempt, maxAttempts)) continue;
          break;
        }
        // An agent that said `failed` and then ended some other way: said
        // in the order it came, as before anything was held.
        if (held !== undefined) yield held;

        const cutByCeiling = outcome === "cancelled" && state.cancelReason !== undefined;
        if (!cutByCeiling) break;
        // The chain's own cancel flag was set by the timer calling
        // `cancel()`; clearing it is what makes a further attempt
        // possible, and it is cleared only on this path — a person's
        // cancel leaves it set and ends the chain.
        state.cancelRequested = false;
        if (attempt >= maxAttempts) {
          const spentAttempts = say("OSW-RUN-209", { stage, attempts: attempt, max: maxAttempts, reason: state.cancelReason ?? "" });
          yield { kind: "cancelled", runId, timestamp: nowIso(), reason: spentAttempts.text, code: spentAttempts.code };
          return;
        }
        yield {
          kind: "stageStarted",
          runId,
          timestamp: nowIso(),
          stage,
          agentId: stageAgentOf(stage, harnessConfig, state),
          attempt: attempt + 1,
          previousAttemptReason: state.cancelReason,
        };
      }

      // A stop asked for while the stage ran, which then ended on its own
      // before a task boundary came: no further stage starts
      // (a-change-is-run-from-its-card).
      if (state.stopRequest !== undefined && (outcome === "checks-failed" || (outcome === "completed" && hasNextStage))) {
        yield* this.announceStop(command, state);
        yield { kind: "cancelled", runId, timestamp: nowIso() };
        return;
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
        const finalized = await this.readApplyCheckpoint(applyCheckpoint);
        verifiedDelta = finalized.delta;
        const tickedNothing = await describeApplyThatTickedNothing(tasksBeforeApply, context.changeDir, verifiedDelta);
        if (tickedNothing !== undefined) {
          yield { kind: "progress", runId, timestamp: nowIso(), message: tickedNothing.text, code: tickedNothing.code };
        }
        // Nothing changed and nothing ticked, with work of its own open: the
        // chain ends here, before verify and archive run for nothing.
        if (finalized.read && finalized.delta === undefined) {
          const didNothing = await describeApplyThatDidNothing(tasksBeforeApply, context.changeDir, cwd, changeName);
          if (didNothing !== undefined) {
            yield failedEvent(runId, didNothing);
            return;
          }
        }
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

      // A review that asks for changes has the plan updated before apply,
      // once, on the review's own agent; the update is part of the review
      // stage, so the chain keeps its six stages (ADR 0041). A review that
      // says the plan is ready, or says nothing, goes on as before.
      if (stage === "review" && state.reviewVerdict === "changes-needed") {
        state.reviewVerdict = undefined;
        yield { kind: "progress", runId, timestamp: nowIso(), message: "the review asks for changes: updating the plan before apply" };
        yield {
          kind: "stageStarted",
          runId,
          timestamp: nowIso(),
          stage,
          agentId: stageAgentOf(stage, harnessConfig, state),
          updating: true,
        };
        const updateStartedAt = Date.now();
        const updated = yield* this.runStage(stage, hasNextStage, harnessConfig, command, state, verifiedDelta, "update");
        // The update's time and spend count toward the review stage's, as
        // its audit entries do; a failure `runStage` held is said here,
        // since the update is not tried again.
        state.elapsedMs += Date.now() - updateStartedAt;
        const heldUpdateFailure = state.heldFailure;
        state.heldFailure = undefined;
        if (heldUpdateFailure !== undefined) yield heldUpdateFailure;
        if (updated !== "completed") return;
        const updateSpendReason = describeStageOverspend(harnessConfig, state.lastStageUsage, stage);
        if (updateSpendReason) {
          yield failedEvent(runId, updateSpendReason);
          return;
        }
      }

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
                ? say("OSW-RUN-101", { count: tasks.unchecked, tasks: unfinished })
                : say("OSW-RUN-102", { count: tasks.unchecked, attempts: applyMaxAttempts, tasks: unfinished }),
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
        yield { kind: "cancelled", runId, timestamp: nowIso(), ...cancelledBy(state) };
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
          nextAgentId: stageAgentOf(nextStage, harnessConfig, state),
        };
        const checkpointOutcome = await checkpointPromise;
        if (checkpointOutcome === "cancelled") {
          yield { kind: "cancelled", runId, timestamp: nowIso(), ...cancelledBy(state) };
          return;
        }
        if (checkpointOutcome === "stopped") {
          yield* this.announceStop(command, state);
          yield { kind: "cancelled", runId, timestamp: nowIso() };
          return;
        }
      } else {
        yield { kind: "stageCompleted", runId, timestamp: nowIso(), stage, nextStage };
      }
      // A stop asked for between stages — while a mechanical stage ran, or
      // as a stage handed over — starts no further stage.
      if (state.stopRequest !== undefined) {
        yield* this.announceStop(command, state);
        yield { kind: "cancelled", runId, timestamp: nowIso() };
        return;
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

  private async checkBudget(harnessConfig: HarnessConfig, changeDir: string): Promise<SaidMessage | undefined> {
    const budget = harnessConfig.budget;
    const perUnit = Object.entries(budget?.maxCost ?? {});
    if (!budget || (budget.maxCostUsd === undefined && budget.maxTokens === undefined && perUnit.length === 0)) {
      return undefined;
    }
    if (!this.deps.listAuditEntries) return undefined;

    const entries = await this.deps.listAuditEntries();
    const total = totalForChange(buildUsageReport(entries).totalsByChange, changeDir);
    if (!total) return undefined;

    if (budget.maxCostUsd !== undefined && total.costUsd >= budget.maxCostUsd) {
      return say("OSW-RUN-201", { spent: total.costUsd.toFixed(2), ceiling: budget.maxCostUsd.toFixed(2) });
    }
    if (budget.maxTokens !== undefined) {
      const totalTokens = total.inputTokens + total.outputTokens;
      if (totalTokens >= budget.maxTokens) {
        return say("OSW-RUN-202", { spent: totalTokens, ceiling: budget.maxTokens });
      }
    }
    // A ceiling per unit of account, each against its own unit's total:
    // nothing is converted and nothing is summed across units
    // (a-run-budget-has-a-unit).
    for (const [unit, ceiling] of perUnit) {
      const spent = total.costByUnit[unitKey(unit)] ?? 0;
      if (spent >= ceiling) {
        return say("OSW-RUN-203", { spent, unit, ceiling });
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
   * for the same reason `captureApplyCheckpoint` is, and says whether the
   * checkpoint could be read: "no change" and "could not tell" are different
   * facts, and only the first may stop a chain
   * (an-apply-that-ticks-nothing-ends-the-chain). */
  private async readApplyCheckpoint(checkpoint: WorkbenchCheckpoint): Promise<{ read: boolean; delta: VerifiedDeltaEntry[] | undefined }> {
    try {
      const delta = await finalizeCheckpoint(checkpoint);
      if (delta.length === 0) return { read: true, delta: undefined };
      return {
        read: true,
        delta: delta.map((entry) => ({
          path: entry.path,
          kind: entry.kind,
          before: checkpoint.before.get(entry.path)?.content.toString("utf8"),
          after: checkpoint.after?.get(entry.path)?.content.toString("utf8"),
        })),
      };
    } catch {
      return { read: false, delta: undefined };
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
  /** What the supervisor does about a stage whose agent failed
   * (the-supervisor-changes-agents, design.md decision 5). Under `act`, with
   * an attempt left and a repeat or a move its policy allows, it says so,
   * records it, announces the next attempt and returns `true`; the attempt
   * loop goes on. Otherwise it yields the failure, unchanged, and returns
   * `false` — under `act` after saying why the stage was not tried again. */
  private *superviseHeldFailure(
    stage: ChainStage,
    failure: Extract<Event, { kind: "failed" }>,
    harnessConfig: HarnessConfig,
    state: ChainState,
    command: Command,
    attempt: number,
    maxAttempts: number,
  ): Generator<Event, boolean> {
    const { runId, cwd, context } = command;
    const supervisor = resolveSupervisor(harnessConfig.supervisor);
    // A person's cancel or stop, or a stage that already spent past its
    // ceiling, ends the chain as it did before `act` existed.
    if (
      supervisor.mode !== "act"
      || !isHarnessStepAgentStage(stage)
      || state.cancelRequested
      || state.stopRequest !== undefined
      || describeStageOverspend(harnessConfig, state.lastStageUsage, stage) !== undefined
    ) {
      yield failure;
      return false;
    }
    const current = stageAgentOf(stage, harnessConfig, state) || DEFAULT_AGENT_ID;
    const decision = superviseFailure({
      stage,
      current,
      tried: state.triedAgents.get(stage) ?? [current],
      diagnosis: failure.diagnosis,
      supervisor,
    });
    const goesOn = decision.action !== "none" && attempt < maxAttempts;
    const because = decision.action === "none"
      ? decision.why
      : goesOn
        ? decision.because
        : `${decision.because}, but ${stage} has had ${attempt} attempt(s), the maximum configured (maxStageAttempts: ${maxAttempts})`;
    const action = goesOn ? decision.action : "none";
    const to = goesOn && decision.action === "move" ? decision.agent : undefined;
    const message = action === "move"
      ? `the supervisor moved ${stage} from ${current} to ${to}: ${because}`
      : action === "repeat"
        ? `the supervisor repeats ${stage} on ${current}: ${because}`
        : `the supervisor did not try ${stage} again: ${because}`;
    yield { kind: "progress", runId, timestamp: nowIso(), message };
    this.deps.auditLog?.record({
      runId,
      agent: SUPERVISOR_AGENT_NAME,
      outcome: "message",
      cwd,
      timestamp: nowIso(),
      changeDir: context.changeDir,
      stage,
      reason: message,
      supervisorDecision: { action, stage, from: current, ...(to !== undefined ? { to } : {}), because },
    });
    if (!goesOn) {
      yield failure;
      return false;
    }
    if (to !== undefined) state.agentOverride.set(stage, to);
    yield {
      kind: "stageStarted",
      runId,
      timestamp: nowIso(),
      stage,
      agentId: stageAgentOf(stage, harnessConfig, state),
      attempt: attempt + 1,
      previousAttemptReason: message,
    };
    return true;
  }

  private async *runStage(
    stage: ChainStage,
    hasNextStage: boolean,
    harnessConfig: HarnessConfig,
    command: Command,
    state: ChainState,
    verifiedDelta: VerifiedDeltaEntry[] | undefined,
    /** The command the stage runs instead of its own: `update`, where a
     * review asked for changes (ADR 0041). */
    kindOverride?: CommandKind,
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
        // Named, not only counted — the same reasoning, and the same
        // function, as the return from verification: whoever reads this is
        // about to take the work over. See a-done-task-is-ticked.
        const unfinished = tasks ? await unfinishedTaskTexts(cwd, changeName) : "";
        yield failedEvent(
          runId,
          tasks
            ? `cannot archive "${changeName}": ${tasks.unchecked} task(s) still unchecked (${unfinished}); complete or verify them, then archive`
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
        this.recordVerifyChecks(command, verifyCheckOutcome, harnessConfig, state);
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

    // A stage the supervisor moved runs its new agent with that agent's own
    // defaults: the old entry's model, effort, budget and custom agent were
    // chosen for another agent (the-supervisor-changes-agents).
    const stepAgent = harnessConfig.stepAgents[stage];
    const movedTo = state.agentOverride.get(stage);
    const { agent: agentId, model, effort, budget, customAgent } = movedTo !== undefined
      ? { agent: movedTo, model: undefined, effort: undefined, budget: undefined, customAgent: undefined }
      : stepAgent === undefined
        ? { agent: undefined, model: undefined, effort: undefined, budget: undefined, customAgent: undefined }
        : normalizeStepAgent(stepAgent);
    const runner = this.deps.resolveRunner(agentId, cwd);
    if (!runner) {
      yield failedEvent(runId, `no agent available to run the "${stage}" stage`);
      return "failed";
    }
    const ranOn = agentId ?? DEFAULT_AGENT_ID;
    const tried = state.triedAgents.get(stage) ?? [];
    if (!tried.includes(ranOn)) state.triedAgents.set(stage, [...tried, ranOn]);

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
    // What the operator said while the run was working, handed over now
    // because a stage's start is the only way words reach an agent
    // (the-operator-can-say-something-to-a-run).
    const taken = state.pendingMessages.splice(0, state.pendingMessages.length);
    if (taken.length > 0) {
      const section = buildOperatorMessagesSection(taken);
      stageContext = {
        ...stageContext,
        promptContext: stageContext.promptContext ? `${stageContext.promptContext}\n\n${section}` : section,
      };
      for (const message of taken) {
        this.deps.auditLog?.record({
          runId,
          agent: "chain",
          outcome: "message",
          cwd,
          timestamp: nowIso(),
          changeDir: context.changeDir,
          operatorMessage: { messageId: message.messageId, kind: message.kind, from: message.from, stage },
        });
      }
      state.awaitingAnswer = taken.filter((message) => message.kind === "ask");
    } else {
      state.awaitingAnswer = [];
    }

    // `stage` travels beside `model`/`effort`/`budget`, which the chain
    // already sets here — it is what lets an audit entry say which stage
    // spent what, since every stage runs under the chain's own runId.
    const stageCommand: Command = { kind: kindOverride ?? CHAIN_STAGE_COMMAND[stage], cwd, context: stageContext, runId, agentId, model, effort, budget, customAgent, stage };
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
    /** What the agent said at the end of this stage, for an answer: the
     * stage's closing summary where it has one, and otherwise the tail of
     * what it streamed. */
    let said: string | undefined;
    let saidTail = "";
    const remember = (text: string): void => {
      if (text.trim().length === 0) return;
      saidTail = `${saidTail}${text}`.slice(-ANSWER_WORDS_LIMIT);
    };
    // A stop asked for while this stage runs ends it at a sound point
    // (a-change-is-run-from-its-card). Where is decided by
    // `untilStopBoundary`, the same way for a chain's stage as for a
    // single-stage run.
    const events = untilStopBoundary({
      events: runner.run(stageCommand),
      changeDir: context.changeDir,
      stopAsked: () => state.stopRequest !== undefined,
      stopAfterTask: () => state.heldStop?.afterTask,
      onStopAfterDue: (due) => this.heldStopIsDue(command, state, due),
      onWake: (wake) => {
        state.stopWake = wake;
      },
      announce: () => this.announceStop(command, state),
      denyPermission: (requestId) => drainInBackground(runner.run({
        ...stageCommand,
        kind: "resolvePermission",
        permissionRequestId: requestId,
        permissionOutcome: "deny",
      })),
      endRun: () => drainInBackground(runner.run({ ...stageCommand, kind: "cancel" })),
      // Under `autonomous` a permission request fails the stage below, as it
      // always has.
      mayDenyPermissions: harnessConfig.autonomyLevel !== "autonomous",
    });
    try {
      for await (const event of events) {
        // A wait for the operator's answers begins with `awaitingAnswers`
        // and ends with whatever the stage does next (ADR 0042).
        if (event.kind === "awaitingAnswers") {
          state.operatorWaitSince ??= Date.now();
        } else if (state.operatorWaitSince !== undefined && event.kind !== "question" && event.kind !== "questionAnswered") {
          state.operatorWaitMs += Date.now() - state.operatorWaitSince;
          state.operatorWaitSince = undefined;
        }
        if (event.kind === "permissionRequest" && harnessConfig.autonomyLevel === "autonomous" && !autonomousPermissionFailure) {
          autonomousPermissionFailure = true;
          outcome = "failed";
          yield event;
          yield failedEvent(runId, say("OSW-PRM-101", { request: event.description }));
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
          // What the review said of the plan, for the update that may
          // follow it (ADR 0041).
          if (stage === "review" && kindOverride === undefined) state.reviewVerdict = event.reviewVerdict;
          // What this stage said, kept for a question that is waiting on
          // it (the-operator-can-say-something-to-a-run).
          if (typeof event.summary === "string" && event.summary.trim().length > 0) said = event.summary.trim();
          if (hasNextStage) continue;
          yield event;
          continue;
        }
        if (event.kind === "stdout") remember(event.chunk);
        if (event.kind === "agentUpdate") {
          remember(readAcpStreamedText(event.update)?.text ?? "");
          // The one ceiling besides `timeout` that can stop a stage
          // already running: the gauge arrives during the run, where a
          // cost only arrives at its end (a-run-can-outgrow-its-context).
          const ceiling = harnessConfig.budget?.maxContextShare;
          const gauge = ceiling === undefined ? undefined : readAcpContextGauge(event.update);
          if (ceiling !== undefined && gauge !== undefined && gauge.share > ceiling && state.cancelReason === undefined) {
            state.cancelReason = describeContextShare(gauge, ceiling);
            state.cancelCode = undefined;
            this.cancel(runId);
          }
        }
        if (event.kind === "usageReported") state.lastStageUsage = event.usage;
        if (event.kind === "failed") {
          // Held, not yielded: only the attempt loop knows whether the
          // supervisor tries the stage again, and a stage that goes on must
          // not have said `failed` (the-supervisor-changes-agents).
          outcome = "failed";
          state.heldFailure = event;
          continue;
        }
        if (event.kind === "cancelled") {
          outcome = "cancelled";
          // The runner reports that its process is gone; only the chain
          // knows a rule caused that rather than a person, so the reason
          // is attached here rather than invented downstream.
          yield state.cancelReason ? { ...event, ...cancelledBy(state) } : event;
          continue;
        }
        yield event;
      }
    } finally {
      state.stopWake = undefined;
      state.currentRunner = undefined;
      state.currentCommand = undefined;
    }
    await this.answerWhatWasAsked(state, stage, runId, said ?? (saidTail.trim() || undefined), outcome);
    return outcome;
  }

  /** Answers every question this stage carried, with what the agent said.
   *
   * There is no separate turn and no second model call: the question was in
   * the prompt, and the stage's own closing words are the reply. A stage
   * that said nothing answers with how it ended, which is still an answer -
   * silence would leave a person waiting for one that never comes. */
  private async answerWhatWasAsked(
    state: ChainState,
    stage: ChainStage,
    runId: string,
    said: string | undefined,
    outcome: "completed" | "failed" | "cancelled",
  ): Promise<void> {
    const asked = state.awaitingAnswer.splice(0, state.awaitingAnswer.length);
    if (asked.length === 0 || this.deps.answerMessage === undefined) return;
    const words = said ?? `the ${stage} stage ended ${outcome} without a closing summary`;
    for (const question of asked) {
      try {
        await this.deps.answerMessage({ to: question.fromKeyId, answers: question.messageId, words, stage, runId });
      } catch {
        // An answer that cannot be written must not end the run. The audit
        // says the question was delivered; the person can look there.
      }
    }
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
    state: Pick<ChainState, "agentOverride">,
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
      checkedAgent: resolvedApplyAgent(harnessConfig, state),
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
    // The forge `origin` is on: GitHub, GitLab or Gitea (github-without-gh).
    const prGateway = this.deps.createPullRequestGateway
      ? this.deps.createPullRequestGateway({ cwd: command.cwd })
      : await pullRequestGatewayFor(command.cwd);
    const allowlist = this.buildGitStageAllowlist(harnessConfig);

    const branch = await git.currentBranch();
    if (!branch) {
      yield failedEvent(command.runId, "git stage failed: could not resolve current branch");
      return "failed";
    }

    // What the stages left uncommitted goes with the push: a push of a
    // branch that holds none of the change's work leaves the server without
    // it (a-change-is-committed-where-it-is-made). Never on the default
    // branch, where nothing of a change is committed (ADR 0043).
    if (branch !== DEFAULT_PR_BASE_BRANCH && branch !== "master") {
      const changeName = changeNameFromDir(command.context.changeDir);
      const message = `${changeName}: commit what the stages left`;
      const commitInvocation: AdapterInvocation = { kind: "process", executable: "git", args: ["commit", "-m", message] };
      try {
        const commit = await (this.deps.commitWhatIsLeft ?? commitWhatIsLeft)(command.cwd, message);
        if (commit !== undefined) this.recordGitAction(command, commitInvocation, "completed", { summary: `committed ${commit.slice(0, 8)}` });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.recordGitAction(command, commitInvocation, "failed", { reason });
        yield failedEvent(command.runId, say("OSW-GIT-103", { why: reason }));
        return "failed";
      }
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
