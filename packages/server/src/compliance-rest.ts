import type { IncomingMessage, ServerResponse } from "node:http";
import { dispatchCompliance } from "@openspec-ui/core";
import { authorizeCwd, readJsonBody, sendBodyError, sendJson, type RestRequestPolicy } from "./rest.js";

export async function handleComplianceRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let body: unknown;
  try { body = await readJsonBody(req, policy.maxPayloadBytes); }
  catch (error) { sendBodyError(res, error); return; }
  if (typeof body !== "object" || body === null || typeof (body as { cwd?: unknown }).cwd !== "string") {
    sendJson(res, 400, { error: "A Compliance request must include cwd" }); return;
  }
  const cwd = (body as { cwd: string }).cwd;
  if (!authorizeCwd(res, policy, cwd)) return;
  try { sendJson(res, 200, await dispatchCompliance(cwd, body)); }
  catch (error) { sendJson(res, 409, { error: error instanceof Error ? error.message : "Compliance request failed" }); }
}