// How each change's last run ended, over HTTP.
//
// The report is read from every worktree's audit log, so the browser
// cannot produce it. It asks, and a card draws what core's
// `describeChangeCard` makes of it (a-card-says-what-its-change-is-doing).

import type { LastRunsReport } from "@openspec-ui/core/browser";

export type { LastRunsReport };

export type ChangeLastRunsRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export async function loadChangeLastRuns(
  request: ChangeLastRunsRequest,
  cwd: string,
): Promise<LastRunsReport> {
  const response = await request("/api/change-last-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<LastRunsReport>;
}
