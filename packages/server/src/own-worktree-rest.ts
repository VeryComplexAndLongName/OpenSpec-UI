// The routes a card's task controls use — a-card-works-its-own-tasks, ADR
// 0026 amended 2026-10-05.
//
// Every route takes the workspace (`cwd`, checked as every route checks it)
// and a change's name, and core resolves the change's own worktree from the
// repository's worktree list. No route takes a path to act on: a request is
// data from a page, and the directory is the host's to find.

import type { IncomingMessage, ServerResponse } from "node:http";
import {
  commitTaskList,
  readChangeTaskRows,
  resolveRunner,
  runOwnDelegatedItem,
  setTaskDone,
  type AgentRunner,
  type LiveRuns,
} from "@openspec-ui/core";
import { authorizeCwd, readJsonBody, sendBodyError, sendJson, type RestRequestPolicy } from "./rest.js";

interface ChangeRequest {
  cwd: string;
  changeName: string;
}

function isChangeRequest(value: unknown): value is ChangeRequest {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.cwd === "string" && record.cwd.trim().length > 0
    && typeof record.changeName === "string" && record.changeName.trim().length > 0;
}

function hasLine(value: ChangeRequest): value is ChangeRequest & { lineNumber: number } {
  const lineNumber = (value as { lineNumber?: unknown }).lineNumber;
  return typeof lineNumber === "number" && Number.isInteger(lineNumber) && lineNumber >= 0;
}

/** Reads a body that names a change in an allowed workspace, or answers
 * the request itself and returns `undefined`. */
async function changeRequestOf(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<ChangeRequest | undefined> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return undefined;
  }
  if (!isChangeRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain a non-empty cwd and changeName" });
    return undefined;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return undefined;
  return parsed;
}

/** A refusal is an answer, not a transport failure: the caller asked a
 * legitimate question and is told why nothing was done. */
async function answer(res: ServerResponse, work: () => Promise<unknown>): Promise<void> {
  try {
    sendJson(res, 200, await work());
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

/** POST /api/change-tasks — a change's tasks, whole, from its own worktree
 * or, read-only, from this checkout. */
export async function handleChangeTasksRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  const request = await changeRequestOf(req, res, policy);
  if (request === undefined) return;
  await answer(res, () => readChangeTaskRows({ repositoryRoot: request.cwd, changeName: request.changeName }));
}

/** POST /api/change-tasks/set — ticks or unticks one task, with a note. */
export async function handleChangeTaskSetRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  const request = await changeRequestOf(req, res, policy);
  if (request === undefined) return;
  const body = request as ChangeRequest & { expectedText?: unknown; done?: unknown; note?: unknown };
  if (!hasLine(request) || typeof body.expectedText !== "string" || typeof body.done !== "boolean"
    || (body.note !== undefined && typeof body.note !== "string")) {
    sendJson(res, 400, { error: "body must also contain a zero-based lineNumber, the expectedText and done" });
    return;
  }
  const expectedText = body.expectedText;
  const done = body.done;
  const note = typeof body.note === "string" ? body.note : undefined;
  await answer(res, () => setTaskDone({
    repositoryRoot: request.cwd,
    changeName: request.changeName,
    lineNumber: request.lineNumber,
    expectedText,
    done,
    ...(note !== undefined ? { note } : {}),
  }));
}

/** POST /api/change-tasks/commit — commits the task list alone and pushes. */
export async function handleChangeTasksCommitRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  const request = await changeRequestOf(req, res, policy);
  if (request === undefined) return;
  await answer(res, () => commitTaskList({ repositoryRoot: request.cwd, changeName: request.changeName }));
}

/** POST /api/change-tasks/run — runs a delegated task's agent in the
 * change's own worktree, with runners built for that worktree. */
export async function handleChangeTaskRunRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
  runnersFor: (workspaceRoot: string) => Map<string, AgentRunner>,
  liveRuns?: LiveRuns,
): Promise<void> {
  const request = await changeRequestOf(req, res, policy);
  if (request === undefined) return;
  if (!hasLine(request)) {
    sendJson(res, 400, { error: "body must also contain a zero-based lineNumber" });
    return;
  }
  await answer(res, () => runOwnDelegatedItem({
    repositoryRoot: request.cwd,
    changeName: request.changeName,
    lineNumber: request.lineNumber,
    runnersFor: (root) => {
      const runners = runnersFor(root);
      return (agentId) => {
        const runner = resolveRunner(runners, agentId);
        return runner !== undefined && liveRuns !== undefined ? liveRuns.runner(runner) : runner;
      };
    },
  }));
}
