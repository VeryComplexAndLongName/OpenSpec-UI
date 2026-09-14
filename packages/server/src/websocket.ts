// 1.2 WebSocket channel for event-driven commands (plan/implement/review/
// cancel): the command arrives and its events go out over the same connection.
//
// `implement` is the only mutating command kind (matches the extension's
// ImplementationSessionManager, which marks only `implement` runs as
// `mutating: true`), so it alone is routed through WorkbenchRecoveryService's
// scheduler for mutation-lock and cross-host lease enforcement (ADR 0010).
// Every other kind runs exactly as before, direct through the AgentRunner.

import path from "node:path";
import type { WebSocket } from "ws";
import {
  type AgentRunner,
  type AuditLog,
  type Command,
  type Event,
  type HarnessChainRunner,
  agentStopRequestHandlers,
  chainStopRequestHandlers,
  type HarnessStage,
  type LiveRuns,
  VSCODE_CHAT_STEP_AGENT_ID,
  type WorkbenchRecoveryService,
  normalizeStepAgent,
  stepAgentFor,
  resolveHarnessConfig,
  resolveRunner,
  serializeEvent,
  withAgentStatus,
} from "@openspec-ui/core";
import { isCommandLike } from "./wire.js";

function nowIso(): string {
  return new Date().toISOString();
}

/** Mirrors `webui`'s `COMMAND_KIND_TO_HARNESS_STAGE` (`AiPanel.tsx`) and
 * the extension's `STAGE_FOR_COMMAND_KIND` (`webview/ai-panel.ts`): the
 * `HarnessStage` a single-stage `Command.kind` corresponds to. Only these
 * three are ever driven by a single `stepAgents` entry. */
const STAGE_FOR_COMMAND_KIND: Partial<Record<Command["kind"], HarnessStage>> = {
  plan: "propose",
  review: "review",
  implement: "apply",
};

/** The standalone server has no chat to hand a stage to — ADR 0016
 * requires refusing the `vscode-chat` step-runner here with an error, never a
 * silent fallback to spawning the CLI the user did not ask for. Returns
 * `true` (and has already sent the `failed` event) when `command` was
 * refused for exactly this reason. */
async function rejectIfChatDispatch(socket: WebSocket, command: Command): Promise<boolean> {
  const stage = STAGE_FOR_COMMAND_KIND[command.kind];
  if (!stage) return false;

  const changeName = path.basename(command.context.changeDir);
  let harnessConfig;
  try {
    harnessConfig = await resolveHarnessConfig(command.cwd, changeName);
  } catch {
    return false; // malformed config surfaces elsewhere; don't block the run on it here
  }

  const stepAgent = stepAgentFor(harnessConfig.stepAgents, stage);
  if (stepAgent === undefined || normalizeStepAgent(stepAgent).agent !== VSCODE_CHAT_STEP_AGENT_ID) return false;

  if (socket.readyState === socket.OPEN) {
    socket.send(
      serializeEvent({
        kind: "failed",
        runId: command.runId,
        timestamp: nowIso(),
        reason: `stage "${stage}" selects agent "${VSCODE_CHAT_STEP_AGENT_ID}", which the standalone server cannot honour — run it from the VS Code extension instead`,
      }),
    );
  }
  return true;
}

export function handleSocketMessage(
  socket: WebSocket,
  raw: string,
  runners: Map<string, AgentRunner>,
  resolveRecoveryService: (cwd: string) => Promise<WorkbenchRecoveryService>,
  chainRunner: HarnessChainRunner,
  /** The runs this server started and holds, so a card can offer controls
   * only for those (a-change-is-run-from-its-card). One for the process. */
  liveRuns: LiveRuns,
  /** Where a run records a request to stop it that it refused
   * (a-run-elsewhere-can-be-asked-to-stop). */
  auditLog?: AuditLog,
): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return; // payload does not match the protocol — conservatively ignored
  }
  if (!isCommandLike(parsed)) return;
  const command = parsed as Command;

  // `"confirmCheckpoint"` and a `"cancel"` targeting an active chain never
  // reach a single `AgentRunner` at all — they signal the one long-lived
  // `HarnessChainRunner` already driving that `runId` (see
  // harness-chain-runner.ts). `cancel()` returning `false` means `runId`
  // is not a chain at all, so it falls through to the existing generic
  // single-stage cancel path below, unchanged.
  if (command.kind === "confirmCheckpoint") {
    chainRunner.confirmCheckpoint(command.runId);
    return;
  }
  // A "cancel" or "stop" naming an active chain goes through the chain's own
  // `asAgentRunner()`, so the socket that sent it hears back: `cancelling`
  // for a cancel, and for a stop the chain's stream carries `stopRequested`
  // (a-change-is-run-from-its-card).
  if ((command.kind === "cancel" || command.kind === "stop") && chainRunner.holds(command.runId)) {
    void streamToSocket(socket, chainRunner.asAgentRunner().run(command));
    return;
  }
  // Same reasoning as `cancel` above: a `"resolvePermission"` naming an
  // active chain's runId must reach the runner executing that chain's
  // stage in flight, not the single-stage path below, which would resolve
  // by `command.agentId` (`undefined` for this command) and answer nothing
  // (see harness-chain-runner.ts's `resolvePermission()`). `false` means
  // `runId` is not a chain, so it falls through unchanged.
  if (command.kind === "resolvePermission" && chainRunner.resolvePermission(command)) {
    return;
  }
  if (command.kind === "chain") {
    void streamChainRun(socket, chainRunner, command, resolveRecoveryService, liveRuns, auditLog);
    return;
  }

  // A request about a single-stage run names no agent, and the default
  // runner has never heard of a run started on another: it goes to the
  // runner that holds the run.
  const held = command.kind === "cancel" || command.kind === "stop" ? liveRuns.get(command.runId) : undefined;
  const routed = held?.agentId !== undefined && command.agentId === undefined ? { ...command, agentId: held.agentId } : command;
  void dispatchSingleStage(socket, routed, runners, resolveRecoveryService, liveRuns, auditLog);
}

async function streamToSocket(socket: WebSocket, events: AsyncIterable<Event>): Promise<void> {
  for await (const event of events) {
    if (socket.readyState === socket.OPEN) socket.send(serializeEvent(event));
  }
}

async function dispatchSingleStage(
  socket: WebSocket,
  command: Command,
  runners: Map<string, AgentRunner>,
  resolveRecoveryService: (cwd: string) => Promise<WorkbenchRecoveryService>,
  liveRuns: LiveRuns,
  auditLog?: AuditLog,
): Promise<void> {
  if (await rejectIfChatDispatch(socket, command)) return;

  const runner = resolveRunner(runners, command.agentId);
  if (!runner) {
    socket.send(
      serializeEvent({
        kind: "failed",
        runId: command.runId,
        timestamp: nowIso(),
        reason: `unknown agentId: ${String(command.agentId)}`,
      }),
    );
    return;
  }

  // Every run started here passes through the one registry; a request about
  // a run (cancel, a permission's answer) is passed through untracked.
  await streamRun(socket, liveRuns.runner(runner), command, resolveRecoveryService, auditLog);
}

/** Same shape as `streamAgentEvents`, over `chainRunner.run(command)`
 * instead of a single `AgentRunner` — a chain's `apply`/`archive` stages
 * mutate the repository exactly like a standalone `implement` does, so a
 * chain is always run through the mutation-lock/cross-host lease path
 * (`recovery.runMutating`), never the plain branch `streamRun` uses for
 * non-mutating single-stage commands. */
async function streamChainEvents(
  socket: WebSocket,
  chainRunner: HarnessChainRunner,
  command: Command,
  report: (message: string) => void,
  liveRuns: LiveRuns,
  auditLog?: AuditLog,
): Promise<string | undefined> {
  let summary: string | undefined;
  let failureReason: string | undefined;
  // A request to stop this run, from another worktree, stops it where its
  // work is sound (a-run-elsewhere-can-be-asked-to-stop).
  const stopHandlers = chainStopRequestHandlers(chainRunner, command, auditLog);
  for await (const event of withAgentStatus(liveRuns.track(command, chainRunner.run(command)), command, stopHandlers)) {
    if (socket.readyState === socket.OPEN) socket.send(serializeEvent(event));
    if (event.kind === "progress") report(event.message);
    if (event.kind === "stageCompleted" || event.kind === "checkpoint") report(`${event.stage} -> ${event.nextStage}`);
    if (event.kind === "completed") summary = event.summary;
    if (event.kind === "failed") failureReason = event.reason;
  }
  if (failureReason !== undefined) throw new Error(failureReason);
  return summary;
}

async function streamChainRun(
  socket: WebSocket,
  chainRunner: HarnessChainRunner,
  command: Command,
  resolveRecoveryService: (cwd: string) => Promise<WorkbenchRecoveryService>,
  liveRuns: LiveRuns,
  auditLog?: AuditLog,
): Promise<void> {
  const recovery = await resolveRecoveryService(command.cwd);
  const changeName = path.basename(command.context.changeDir);
  let process;
  try {
    process = await recovery.runMutating(
      command.runId,
      command.kind,
      changeName,
      (context) => streamChainEvents(socket, chainRunner, command, context.report, liveRuns, auditLog),
      command.agentId,
    );
  } catch (error) {
    if (socket.readyState === socket.OPEN) {
      socket.send(
        serializeEvent({
          kind: "failed",
          runId: command.runId,
          timestamp: nowIso(),
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return;
  }
  if (process.state === "failed" && process.startedAt === undefined) {
    if (socket.readyState === socket.OPEN) {
      socket.send(
        serializeEvent({
          kind: "failed",
          runId: command.runId,
          timestamp: nowIso(),
          reason: process.error ?? "run did not start",
        }),
      );
    }
  }
}

/** Streams `runner.run(command)`'s events to the socket, reporting
 * progress and the completion summary through `report`. Throws on a
 * `failed` terminal event so a lease-gated caller can mark the scheduler
 * process failed too — every event has already reached the socket by
 * then regardless. */
async function streamAgentEvents(
  socket: WebSocket,
  runner: AgentRunner,
  command: Command,
  report: (message: string) => void,
  auditLog?: AuditLog,
): Promise<string | undefined> {
  let summary: string | undefined;
  let failureReason: string | undefined;
  for await (const event of withAgentStatus(runner.run(command), command, agentStopRequestHandlers(runner, command, auditLog))) {
    if (socket.readyState === socket.OPEN) socket.send(serializeEvent(event));
    if (event.kind === "progress") report(event.message);
    if (event.kind === "completed") summary = event.summary;
    if (event.kind === "failed") failureReason = event.reason;
  }
  if (failureReason !== undefined) throw new Error(failureReason);
  return summary;
}

async function streamRun(
  socket: WebSocket,
  runner: AgentRunner,
  command: Command,
  resolveRecoveryService: (cwd: string) => Promise<WorkbenchRecoveryService>,
  auditLog?: AuditLog,
): Promise<void> {
  if (command.kind !== "implement") {
    for await (const event of withAgentStatus(runner.run(command), command, agentStopRequestHandlers(runner, command, auditLog))) {
      if (socket.readyState === socket.OPEN) {
        socket.send(serializeEvent(event));
      }
    }
    return;
  }

  const recovery = await resolveRecoveryService(command.cwd);
  const changeName = path.basename(command.context.changeDir);
  let process;
  try {
    process = await recovery.runMutating(
      command.runId,
      command.kind,
      changeName,
      (context) => streamAgentEvents(socket, runner, command, context.report, auditLog),
      command.agentId,
    );
  } catch (error) {
    if (socket.readyState === socket.OPEN) {
      socket.send(
        serializeEvent({
          kind: "failed",
          runId: command.runId,
          timestamp: nowIso(),
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return;
  }
  if (process.state === "failed" && process.startedAt === undefined) {
    // Blocked before the agent ever ran (another host holds the workspace
    // lease) — no event for this attempt has reached the socket yet.
    if (socket.readyState === socket.OPEN) {
      socket.send(
        serializeEvent({
          kind: "failed",
          runId: command.runId,
          timestamp: nowIso(),
          reason: process.error ?? "run did not start",
        }),
      );
    }
  }
}
