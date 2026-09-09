// The workspace's schedule, over HTTP.
//
// The schedule is a file the browser cannot read, for the same reason
// the run figures and the custom agents are: it lives on disk beside the
// audit log. Whether an entry is due is decided here, though — that is a
// comparison against the clock, and `readSchedule` is pure.
//
// See a-run-can-be-scheduled.

import type { ScheduledRun } from "@openspec-ui/core/browser";

export type { ScheduledRun };

export type ScheduledRunsRequest = (pathname: string, init: RequestInit) => Promise<Response>;

async function post(
  request: ScheduledRunsRequest,
  body: Record<string, unknown>,
): Promise<ScheduledRun[]> {
  const response = await request("/api/scheduled-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as { entries: ScheduledRun[] };
  return payload.entries;
}

export function loadScheduledRuns(request: ScheduledRunsRequest, cwd: string): Promise<ScheduledRun[]> {
  return post(request, { cwd });
}

export function addScheduledRun(
  request: ScheduledRunsRequest,
  cwd: string,
  entry: ScheduledRun,
): Promise<ScheduledRun[]> {
  return post(request, { cwd, add: entry });
}

/** Removes one — what happens when it starts. The list comes back so the
 * caller never has to guess what is left. */
export function removeScheduledRun(
  request: ScheduledRunsRequest,
  cwd: string,
  entry: ScheduledRun,
): Promise<ScheduledRun[]> {
  return post(request, { cwd, remove: entry });
}
