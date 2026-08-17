import type { ChangeEditorRequest } from "./change-editor-client.js";

async function responseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? `${response.status} ${response.statusText}`;
}

export async function detectAgents(request: ChangeEditorRequest, cwd: string): Promise<Record<string, boolean>> {
  const response = await request("/api/agents/detect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  const body = (await response.json()) as { agents: Record<string, boolean> };
  return body.agents;
}
