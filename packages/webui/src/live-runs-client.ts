// The runs this host started and holds, over HTTP
// (a-change-is-run-from-its-card).
//
// The server holds them in its own process, so the browser cannot know
// them. A card asks, and offers to answer or stop only a run among these.

import type { LiveRun } from "@openspec-ui/core/browser";

export type { LiveRun };

export type LiveRunsRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export async function loadLiveRuns(request: LiveRunsRequest, cwd: string): Promise<{ runs: LiveRun[]; myLabel?: string }> {
  const response = await request("/api/live-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<{ runs: LiveRun[]; myLabel?: string }>;
}

/** Asks a run held elsewhere to stop, through the server, which writes the
 * signed request with its own key after checking the run is live
 * (a-run-elsewhere-can-be-asked-to-stop). Resolves to the request's message
 * id, or rejects with why nothing was asked. */
export async function askRunToStop(request: LiveRunsRequest, cwd: string, instanceId: string, reason: string): Promise<string> {
  const response = await request("/api/runs/ask-to-stop", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, instanceId, reason }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; messageId?: string };
  if (!response.ok || payload.messageId === undefined) {
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return payload.messageId;
}
