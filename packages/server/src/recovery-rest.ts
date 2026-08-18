import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  WorkbenchCleanupResult,
  WorkbenchRecoveryDetails,
  WorkbenchRecoveryService,
  WorkbenchProcess,
  RollbackResult,
} from "@openspec-ui/core";
import type { RestRequestPolicy } from "./rest.js";

interface RecoveryRequest {
  cwd: string;
  processId?: string;
  cutoff?: string;
  changeName?: string;
}

export type RecoveryServiceResolver = (cwd: string) => Promise<WorkbenchRecoveryService>;

async function readBody(req: IncomingMessage, maxPayloadBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buffer.byteLength;
    if (total > maxPayloadBytes) throw new Error("payload-too-large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function isRequest(value: unknown): value is RecoveryRequest {
  return typeof value === "object" && value !== null && typeof (value as RecoveryRequest).cwd === "string";
}

async function parseAuthorizedRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
): Promise<RecoveryRequest | undefined> {
  let value: unknown;
  try {
    value = await readBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendJson(res, error instanceof Error && error.message === "payload-too-large" ? 413 : 400, { error: "invalid request body" });
    return undefined;
  }
  if (!isRequest(value) || !value.cwd.trim()) {
    sendJson(res, 400, { error: "body must contain cwd" });
    return undefined;
  }
  if (!policy.isCwdAllowed(value.cwd)) {
    sendJson(res, 403, { error: "cwd is outside the configured workspace" });
    return undefined;
  }
  return value;
}

async function withRecoveryRequest<T>(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
  resolveService: RecoveryServiceResolver,
  operation: (request: RecoveryRequest, service: WorkbenchRecoveryService) => Promise<T> | T,
): Promise<void> {
  const request = await parseAuthorizedRequest(req, res, policy);
  if (!request) return;
  try {
    sendJson(res, 200, await operation(request, await resolveService(request.cwd)));
  } catch (error) {
    sendJson(res, 409, { error: error instanceof Error ? error.message : String(error) });
  }
}

export function handleProcessesListRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
  resolveService: RecoveryServiceResolver,
): Promise<void> {
  return withRecoveryRequest<WorkbenchProcess[]>(req, res, policy, resolveService, (_request, service) => service.list());
}

export function handleProcessDetailsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
  resolveService: RecoveryServiceResolver,
): Promise<void> {
  return withRecoveryRequest<WorkbenchRecoveryDetails>(req, res, policy, resolveService, (request, service) => {
    if (!request.processId) throw new Error("processId is required");
    const details = service.details(request.processId);
    if (!details) throw new Error("process not found");
    return details;
  });
}

export function handleProcessRollbackRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
  resolveService: RecoveryServiceResolver,
): Promise<void> {
  return withRecoveryRequest<RollbackResult>(req, res, policy, resolveService, (request, service) => {
    if (!request.processId) throw new Error("processId is required");
    return service.rollback(request.processId);
  });
}

export function handleChangeRollbackRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
  resolveService: RecoveryServiceResolver,
): Promise<void> {
  return withRecoveryRequest<RollbackResult>(req, res, policy, resolveService, (request, service) => {
    if (!request.changeName) throw new Error("changeName is required");
    return service.rollbackChange(request.changeName);
  });
}

export function handleProcessesCleanupRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
  resolveService: RecoveryServiceResolver,
): Promise<void> {
  return withRecoveryRequest<WorkbenchCleanupResult>(req, res, policy, resolveService, (request, service) => {
    if (!request.cutoff) throw new Error("cutoff is required");
    return service.cleanupBefore(new Date(request.cutoff));
  });
}
