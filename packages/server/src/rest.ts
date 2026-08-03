// 1.1 REST-эндпоинт для `status` — синхронный ответ с полным списком
// событий этого запуска. `status` — обычная команда `execution-core`
// (см. `@openspec-ui/core`'s agents/shared.ts commandInstruction), просто
// достаточно быстрая, чтобы не требовать WS ради неё (см.
// openspec/changes/standalone-app/design.md, "Decisions").

import type { IncomingMessage, ServerResponse } from "node:http";
import { type AgentRunner, type Command, type Event, resolveRunner } from "@openspec-ui/core";
import { isCommandLike } from "./wire.js";

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export async function handleStatusRequest(
  req: IncomingMessage,
  res: ServerResponse,
  runners: Map<string, AgentRunner>,
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  if (!isCommandLike(parsed)) {
    sendJson(res, 400, { error: "body does not match the Command shape" });
    return;
  }
  const command = parsed as Command;

  const runner = resolveRunner(runners, command.agentId);
  if (!runner) {
    sendJson(res, 400, { error: `unknown agentId: ${String(command.agentId)}` });
    return;
  }

  const events: Event[] = [];
  for await (const event of runner.run(command)) {
    events.push(event);
  }
  sendJson(res, 200, { events });
}
