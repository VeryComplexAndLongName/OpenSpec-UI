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

import type { AgentRunner } from "./agent-runner.js";
import type { Command, CommandKind, Event } from "./protocol.js";
import { type HarnessConfig, readChangeHarnessConfig, resolveHarnessConfig } from "./harness-config.js";
import { archiveChange, statusChange } from "./openspec.js";

/** The subsequence of `HarnessStage` a chain actually drives — deliberately
 * excludes `"git"`: a chain never invokes the `git` stepAgent under any
 * configuration (see ADR 0012, "the `git` stepAgent's actual commit/push
 * action is out of scope"). Each entry's `AgentRunner` `CommandKind`, where
 * one exists — `"archive"` has none: it is a mechanical operation
 * (`archiveChange`), not a CLI-agent invocation. */
const CHAIN_STAGE_COMMAND: Readonly<Record<"propose" | "review" | "apply", CommandKind>> = {
  propose: "plan",
  review: "review",
  apply: "implement",
};
const CHAIN_STAGES = ["propose", "review", "apply", "archive"] as const;
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

/** Determines the first not-yet-complete stage for a change, reusing the
 * same status signal the `status` command already reports — no new
 * "is this stage done" mechanism (see design.md, "Stage detection reuses
 * the existing status signal"). `review` has no durable artifact of its
 * own in the upstream `openspec status` schema, so it is only ever the
 * start stage as a side effect of `propose` being incomplete — a chain
 * resuming after `propose` is already done starts at `apply` directly
 * (this session's own `review`, if any, already happened; a chain cannot
 * tell whether an earlier one did, and re-running it unconditionally on
 * every resume would be surprising and wasteful). */
async function determineStartStage(cwd: string, changeName: string): Promise<ChainStage> {
  const status = await statusChange(changeName, { cwd });
  const isDone = (artifactId: string): boolean =>
    status.artifacts.some((artifact) => {
      if (artifact.id !== artifactId) return false;
      const normalized = artifact.status.toLowerCase();
      return normalized === "done" || normalized === "complete";
    });
  const proposeDone = isDone("proposal") && isDone("design") && isDone("tasks");
  if (!proposeDone) return "propose";
  if (status.progress.remaining > 0) return "apply";
  return "archive";
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
   * within this runner's control), or marks it for cancellation once the
   * currently running stage's own execution ends otherwise. This product
   * has no hard child-process-kill mechanism for any single-stage run
   * today (see `agents/shared.ts`'s `spawnAndStream` — no `AbortSignal` is
   * wired to the spawned process); mid-stage cancellation mirrors the
   * existing single-stage convention (`RunController.cancel()`: re-send a
   * `"cancel"`-kind `Command` to the same runner) as a best effort, and
   * guarantees the CHAIN itself stops advancing to a further stage — it
   * does not guarantee the underlying CLI process exits early. Returns
   * `false` only if `runId` names no active chain at all. */
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
      startStage = await determineStartStage(cwd, changeName);
    } catch (error) {
      yield failedEvent(runId, error instanceof Error ? error.message : String(error));
      return;
    }

    const sequence = CHAIN_STAGES.slice(CHAIN_STAGES.indexOf(startStage));

    for (let index = 0; index < sequence.length; index += 1) {
      const stage = sequence[index] as ChainStage;
      const hasNextStage = index < sequence.length - 1;

      const outcome = yield* this.runStage(stage, hasNextStage, harnessConfig, command, state);
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
          nextAgentId: nextStage === "archive" ? "" : (harnessConfig.stepAgents[nextStage] ?? ""),
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
  ): AsyncGenerator<Event, "completed" | "failed" | "cancelled"> {
    const { cwd, context, runId } = command;

    if (stage === "archive") {
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

    const agentId = harnessConfig.stepAgents[stage];
    const runner = this.deps.resolveRunner(agentId);
    if (!runner) {
      yield failedEvent(runId, `no agent available to run the "${stage}" stage`);
      return "failed";
    }

    const stageCommand: Command = { kind: CHAIN_STAGE_COMMAND[stage], cwd, context, runId, agentId };
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
