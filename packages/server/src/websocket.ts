// 1.2 WebSocket channel for event-driven commands (plan/implement/review/
// cancel): the command arrives and its events go out over the same connection.

import type { WebSocket } from "ws";
import { type AgentRunner, type Command, resolveRunner, serializeEvent } from "@openspec-ui/core";
import { isCommandLike } from "./wire.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function handleSocketMessage(
  socket: WebSocket,
  raw: string,
  runners: Map<string, AgentRunner>,
): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return; // payload does not match the protocol — conservatively ignored
  }
  if (!isCommandLike(parsed)) return;
  const command = parsed as Command;

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

  void streamRun(socket, runner, command);
}

async function streamRun(socket: WebSocket, runner: AgentRunner, command: Command): Promise<void> {
  for await (const event of runner.run(command)) {
    if (socket.readyState === socket.OPEN) {
      socket.send(serializeEvent(event));
    }
  }
}
