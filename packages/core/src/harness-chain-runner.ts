// Chain execution for the Agentic Harness — see
// docs/adr/0012-agentic-harness-chain-execution-protocol.md and
// openspec/changes/agentic-harness-autonomy/design.md. Sequences
// `propose -> review -> apply -> archive` for a change under one `runId`,
// pausing at a `checkpoint` (semi-autonomous, the default) or continuing
// immediately via `stageCompleted` (autonomous, or a per-change
// `checkpoints.requireConfirmationBetweenSteps: false`). Never reaches the
// `git` stage under any configuration — see "Hard stop" below.
//
// Lives in `packages/core`, not `webui`/`extension`: which stage is next,
// whether a transition pauses, and whether `autonomous` is actually
// permitted for this change are harness domain decisions, not view logic
// (see design.md, "Chain runner lives in packages/core, not webui" — a
// client-side orchestrator would duplicate this logic across both delivery
// targets and could not outlive a closed webview).

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentRunner } from "./agent-runner.js";
import { captureCheckpoint, finalizeCheckpoint, type WorkbenchCheckpoint } from "./checkpoint.js";
import type { Command, CommandKind, Event, VerifiedDeltaEntry } from "./protocol.js";
import { type HarnessConfig, normalizeStepAgent, readChangeHarnessConfig, resolveHarnessConfig } from "./harness-config.js";
import { archiveChange, statusChange } from "./openspec.js";
import type { AuditEntry } from "./security.js";
import { TASK_CHECKBOX_LINE_RE } from "./task-checklist.js";
import { buildUsageReport } from "./usage-report.js";

/** The subsequence of `HarnessStage` a chain actually drives — deliberately
 * excludes `"git"`: a chain never invokes the `git` stepAgent under any
 * configuration (see ADR 0012, "the `git` stepAgent's actual commit/push
 * action is out of scope"). Each entry's `AgentRunner` `CommandKind`, where
 * one exists — `"archive"` has none: it is a mechanical operation
 * (`archiveChange`), not a CLI-agent invocation. */
const CHAIN_STAGE_COMMAND: Readonly<Record<"propose" | "review" | "apply" | "verify", CommandKind>> = {
  propose: "plan",
  review: "review",
  apply: "implement",
  verify: "verify",
};
const CHAIN_STAGES = ["propose", "review", "apply", "verify", "archive"] as const;
type ChainStage = (typeof CHAIN_STAGES)[number];

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

  constructor(private readonly deps: HarnessChainDeps) {}

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
          this.cancel(command.runId);
          return (async function* empty() {})();
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

      const applyCheckpoint = stage === "apply" ? await this.captureApplyCheckpoint(cwd) : undefined;

      const outcome = yield* this.runStage(stage, hasNextStage, harnessConfig, command, state, verifiedDelta);

      if (stage === "apply" && applyCheckpoint && outcome === "completed") {
        verifiedDelta = await this.finalizeApplyCheckpoint(applyCheckpoint);
      }

      if (outcome !== "completed") return;
      if (!hasNextStage) return;
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
          // "archive" has no agent (mechanical) — "" reads as "no agent
          // required for the next stage", not "unknown".
          nextAgentId: nextStage === "archive"
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

    const stepAgent = harnessConfig.stepAgents[stage];
    const { agent: agentId, model, effort, budget } = stepAgent === undefined
      ? { agent: undefined, model: undefined, effort: undefined, budget: undefined }
      : normalizeStepAgent(stepAgent);
    const runner = this.deps.resolveRunner(agentId);
    if (!runner) {
      yield failedEvent(runId, `no agent available to run the "${stage}" stage`);
      return "failed";
    }

    // Only the "verify" stage's context carries a delta — every other
    // stage keeps the exact same `context` object the top-level command
    // was given, so its prompt stays byte-identical to before this stage
    // existed (see security.ts, buildVerifiedDeltaSection's absent-field
    // path).
    const stageContext = stage === "verify" && verifiedDelta ? { ...context, verifiedDelta } : context;
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
}
