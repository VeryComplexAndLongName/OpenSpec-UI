// The runs this host started and holds, over HTTP
// (a-change-is-run-from-its-card).
//
// The server holds them in its own process, so the browser cannot know
// them. A card asks, and offers to answer or stop only a run among these.

import type { LiveRun } from "@openspec-ui/core/browser";

export type { LiveRun };

export type LiveRunsRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export async function loadLiveRuns(request: LiveRunsRequest, cwd: string): Promise<{ runs: LiveRun[] }> {
  const response = await request("/api/live-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<{ runs: LiveRun[] }>;
}
