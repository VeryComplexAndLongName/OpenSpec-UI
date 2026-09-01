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
  type Command,
  type HarnessChainRunner,
  type HarnessStage,
  type WorkbenchRecoveryService,
  normalizeStepAgent,
  resolveHarnessConfig,
  resolveRunner,
  serializeEvent,
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
 * requires refusing `dispatch: "vscode-chat"` here with an error, never a
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

  const stepAgent = harnessConfig.stepAgents[stage];
  if (stepAgent === undefined || normalizeStepAgent(stepAgent).dispatch !== "vscode-chat") return false;

  if (socket.readyState === socket.OPEN) {
    socket.send(
      serializeEvent({
        kind: "failed",
        runId: command.runId,
        timestamp: nowIso(),
        reason: `stage "${stage}" is configured with dispatch "vscode-chat", which the standalone server cannot honour — run it from the VS Code extension instead`,
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
  if (command.kind === "cancel" && chainRunner.cancel(command.runId)) {
    return;
  }
  if (command.kind === "chain") {
    void streamChainRun(socket, chainRunner, command, resolveRecoveryService);
    return;
  }

  void dispatchSingleStage(socket, command, runners, resolveRecoveryService);
}

async function dispatchSingleStage(
  socket: WebSocket,
  command: Command,
  runners: Map<string, AgentRunner>,
  resolveRecoveryService: (cwd: string) => Promise<WorkbenchRecoveryService>,
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

  await streamRun(socket, runner, command, resolveRecoveryService);
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
): Promise<string | undefined> {
  let summary: string | undefined;
  let failureReason: string | undefined;
  for await (const event of chainRunner.run(command)) {
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
): Promise<void> {
  const recovery = await resolveRecoveryService(command.cwd);
  const changeName = path.basename(command.context.changeDir);
  let process;
  try {
    process = await recovery.runMutating(
      command.runId,
      command.kind,
      changeName,
      (context) => streamChainEvents(socket, chainRunner, command, context.report),
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
): Promise<string | undefined> {
  let summary: string | undefined;
  let failureReason: string | undefined;
  for await (const event of runner.run(command)) {
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
): Promise<void> {
  if (command.kind !== "implement") {
    for await (const event of runner.run(command)) {
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
      (context) => streamAgentEvents(socket, runner, command, context.report),
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
