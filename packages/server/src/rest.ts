// 1.1 REST-эндпоинт для `status` — синхронный ответ с полным списком
// событий этого запуска. `status` — обычная команда `execution-core`
// (см. `@openspec-ui/core`'s agents/shared.ts commandInstruction), просто
// достаточно быстрая, чтобы не требовать WS ради неё (см.
// openspec/changes/standalone-app/design.md, "Decisions").

import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import {
  listChanges,
  listSpecs,
  showChange,
  statusChange,
  validateChange,
  type AgentRunner,
  type Command,
  type Event,
  type OpenSpecChangeListItem,
  type OpenSpecRoot,
  type OpenSpecSpecListItem,
  resolveRunner,
} from "@openspec-ui/core";
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

interface OverviewRequest {
  cwd: string;
}

interface OverviewResponse {
  root: OpenSpecRoot;
  changes: OpenSpecChangeListItem[];
  specs: OpenSpecSpecListItem[];
}

function isOverviewRequest(value: unknown): value is OverviewRequest {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.cwd === "string" && record.cwd.trim().length > 0;
}

function nowIso(): string {
  return new Date().toISOString();
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

export async function handleOverviewRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  if (!isOverviewRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain a non-empty cwd" });
    return;
  }

  const cwd = parsed.cwd;

  try {
    const [changesResult, specsResult] = await Promise.all([
      listChanges({ cwd }),
      listSpecs({ cwd }),
    ]);

    const payload: OverviewResponse = {
      root: changesResult.root,
      changes: changesResult.changes,
      specs: specsResult.specs,
    };
    sendJson(res, 200, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to load OpenSpec overview: ${message}` });
  }
}

export async function handleStatusJsonRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
  const events: Event[] = [
    {
      kind: "started",
      runId: command.runId,
      timestamp: nowIso(),
      command: command.kind,
      cwd: command.cwd,
    },
  ];

  try {
    const changeName = path.basename(command.context.changeDir);
    let result: unknown;
    let summary = "completed";

    switch (command.kind) {
      case "status": {
        if (!changeName) {
          throw new Error("failed to resolve change name from changeDir");
        }
        const status = await statusChange(changeName, { cwd: command.cwd });
        result = status;
        const progress = status.progress;
        if (progress && typeof progress.complete === "number" && typeof progress.total === "number") {
          summary = `${progress.complete}/${progress.total} tasks complete`;
        } else {
          summary = `status loaded for ${status.changeName}`;
        }
        break;
      }
      case "list": {
        const listed = await listChanges({ cwd: command.cwd });
        result = listed;
        summary = `${listed.changes.length} changes listed`;
        break;
      }
      case "show": {
        if (!changeName) {
          throw new Error("failed to resolve change name from changeDir");
        }
        const shown = await showChange(changeName, { cwd: command.cwd });
        result = shown;
        summary = `${shown.deltaCount} deltas in ${shown.id}`;
        break;
      }
      case "validate": {
        if (!changeName) {
          throw new Error("failed to resolve change name from changeDir");
        }
        const validation = await validateChange(changeName, { cwd: command.cwd });
        result = validation;
        summary = `${validation.summary.totals.passed}/${validation.summary.totals.items} passed`;
        break;
      }
      default:
        throw new Error(`unsupported direct OpenSpec command: ${command.kind}`);
    }

    events.push({
      kind: "stdout",
      runId: command.runId,
      timestamp: nowIso(),
      chunk: JSON.stringify(result),
    });
    events.push({
      kind: "completed",
      runId: command.runId,
      timestamp: nowIso(),
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    events.push({
      kind: "failed",
      runId: command.runId,
      timestamp: nowIso(),
      reason: message,
    });
  }

  sendJson(res, 200, { events });
}
