import type { HarnessConfig } from "@openspec-ui/core/browser";
import type { ChangeEditorRequest } from "./change-editor-client.js";

async function responseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? `${response.status} ${response.statusText}`;
}

/** Resolves the Agentic Harness config (global + optional per-change
 * override, merged) — see openspec/changes/agentic-harness/. */
export async function resolveHarnessConfig(
  request: ChangeEditorRequest,
  cwd: string,
  changeName?: string,
): Promise<HarnessConfig> {
  const response = await request("/api/harness-config/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, changeName }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<HarnessConfig>;
}

/** Reads the raw per-change `harness.json` override — distinct from
 * `resolveHarnessConfig`, which returns the already-merged result.
 * `null` when no override file exists (the common case, not an error). */
export async function readChangeHarnessOverride(
  request: ChangeEditorRequest,
  cwd: string,
  changeName: string,
): Promise<Partial<HarnessConfig> | null> {
  const response = await request("/api/harness-config/read-change-override", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, changeName }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  const body = (await response.json()) as { override: Partial<HarnessConfig> | null };
  return body.override;
}

/** Writes the global (`changeName` omitted) or per-change harness
 * config. */
export async function writeHarnessConfig(
  request: ChangeEditorRequest,
  cwd: string,
  config: Partial<HarnessConfig>,
  changeName?: string,
): Promise<void> {
  const response = await request("/api/harness-config/write", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, changeName, config }),
  });
  if (!response.ok) throw new Error(await responseError(response));
}
