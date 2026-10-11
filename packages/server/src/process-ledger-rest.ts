// The detached-process half of the recovery surface (ADR 0050): processes
// recorded by a previous host instance are listed with their snapshot
// evidence, and a confirmed termination re-verifies the snapshot against the
// operating system before issuing a tree kill. Nothing here kills on listing,
// and no Compliance path reaches this module.

import type { IncomingMessage, ServerResponse } from "node:http";
import {
  defaultProcessLedger,
  processExpectedDurationMs,
  terminateLedgerProcess,
  terminateProcessTree,
} from "@openspec-ui/core";
import { authorizeCwd, readJsonBody, sendBodyError, sendJson, type RestRequestPolicy } from "./rest.js";

export interface LedgerProcessReading {
  runId: string;
  pid: number;
  executablePath: string;
  hostname: string;
  cwd: string;
  changeName?: string;
  spawnedAt: string;
  exitedAt?: string;
  startTimeAvailable: boolean;
  overdue: boolean;
  orphan: boolean;
  expectedDurationMs?: number;
}

function readingOf(snapshot: {
  runId: string;
  pid: number;
  executablePath: string;
  hostname: string;
  cwd: string;
  changeName?: string;
  spawnedAt: string;
  exitedAt?: string;
  startTime?: string;
}, hostStartedAtMs: number): LedgerProcessReading {
  const ageMs = Date.now() - Date.parse(snapshot.spawnedAt);
  const duration = processExpectedDurationMs(snapshot.executablePath);
  return {
    runId: snapshot.runId,
    pid: snapshot.pid,
    executablePath: snapshot.executablePath,
    hostname: snapshot.hostname,
    cwd: snapshot.cwd,
    ...(snapshot.changeName !== undefined ? { changeName: snapshot.changeName } : {}),
    spawnedAt: snapshot.spawnedAt,
    ...(snapshot.exitedAt !== undefined ? { exitedAt: snapshot.exitedAt } : {}),
    startTimeAvailable: snapshot.startTime !== undefined,
    overdue: duration.known && ageMs > duration.ms,
    orphan: Date.parse(snapshot.spawnedAt) < hostStartedAtMs - 1_000,
    ...(duration.known ? { expectedDurationMs: duration.ms } : {}),
  };
}

/** POST /api/processes/ledger — detached/orphaned processes from the ledger. */
export async function handleLedgerProcessesListRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
  hostStartedAtMs = Date.now() - process.uptime() * 1000,
): Promise<void> {
  let body: unknown;
  try { body = await readJsonBody(req, policy.maxPayloadBytes); }
  catch (error) { sendBodyError(res, error); return; }
  if (typeof body !== "object" || body === null || typeof (body as { cwd?: unknown }).cwd !== "string") {
    sendJson(res, 400, { error: "body must contain cwd" });
    return;
  }
  const cwd = (body as { cwd: string }).cwd;
  if (!authorizeCwd(res, policy, cwd)) return;
  const ledger = defaultProcessLedger(cwd);
  sendJson(res, 200, (ledger?.list() ?? []).map((snapshot) => readingOf(snapshot, hostStartedAtMs)));
}

/** POST /api/processes/terminate — re-verify one snapshot, then kill its tree. */
export async function handleLedgerProcessTerminateRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
): Promise<void> {
  let body: unknown;
  try { body = await readJsonBody(req, policy.maxPayloadBytes); }
  catch (error) { sendBodyError(res, error); return; }
  if (typeof body !== "object" || body === null
    || typeof (body as { cwd?: unknown }).cwd !== "string"
    || typeof (body as { runId?: unknown }).runId !== "string"
    || !Number.isSafeInteger((body as { pid?: unknown }).pid)) {
    sendJson(res, 400, { error: "body must contain cwd, runId and pid" });
    return;
  }
  const { cwd, runId, pid } = body as { cwd: string; runId: string; pid: number };
  if (!authorizeCwd(res, policy, cwd)) return;
  const ledger = defaultProcessLedger(cwd);
  if (ledger === undefined) {
    sendJson(res, 409, { error: "the process ledger is not configured for this host" });
    return;
  }
  const snapshot = ledger.list().find((candidate) => candidate.runId === runId && candidate.pid === pid);
  if (snapshot === undefined) {
    sendJson(res, 409, { error: "process snapshot not found" });
    return;
  }
  try {
    const result = await terminateLedgerProcess(pid, snapshot, terminateProcessTree);
    if (!result.terminated) {
      sendJson(res, 409, { error: result.reason ?? "termination refused" });
      return;
    }
    // The tree kill was issued; resolve the record from this host's
    // bookkeeping. The OS is the authority on whether the process actually
    // died, but no host holds the child handle of an orphaned tree.
    ledger.markExited(runId, pid, new Date().toISOString());
    sendJson(res, 200, { terminated: true });
  } catch (error) {
    sendJson(res, 409, { error: error instanceof Error ? error.message : "termination failed" });
  }
}
