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
  type WorkbenchRecoveryService,
  resolveRunner,
  serializeEvent,
} from "@openspec-ui/core";
import { isCommandLike } from "./wire.js";

function nowIso(): string {
  return new Date().toISOString();
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

  void streamRun(socket, runner, command, resolveRecoveryService);
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
