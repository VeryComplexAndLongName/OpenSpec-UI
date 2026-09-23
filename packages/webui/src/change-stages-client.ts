// Where each change is on the board, over HTTP (a-change-knows-its-stage,
// the-board-shows-the-stages).
//
// The reading runs git and reads the audit log, so the browser cannot make
// it. What comes back is facts; the words are the browser's.

import type { ChangeStageSummary } from "@openspec-ui/core/browser";

export type ChangeStagesRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export async function loadChangeStages(request: ChangeStagesRequest, cwd: string): Promise<ChangeStageSummary[]> {
  const response = await request("/api/change-stages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<ChangeStageSummary[]>;
}
