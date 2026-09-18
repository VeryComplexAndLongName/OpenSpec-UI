// Re-exported from core's browser-safe barrel (not hand-duplicated) —
// see openspec/changes/add-stale-task-detection/design.md for why: a
// hand-duplicated copy of these interfaces already drifted out of sync
// once (missing `lastTouchedDate`) before this module started importing
// them for real.
export type { ChangeSpan, ChangeSpans, ChangeTimeline, ChangeTimelineSpec, ChangeTimelineTask } from "@openspec-ui/core/browser";
import type { ChangeSpans, ChangeTimeline } from "@openspec-ui/core/browser";

export interface ChangeTimelineEntry {
  changeName: string;
  archived: boolean;
}

export type ChangeTimelineRequest = (pathname: string, init: RequestInit) => Promise<Response>;

async function responseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? `${response.status} ${response.statusText}`;
}

export async function loadChangeTimeline(
  request: ChangeTimelineRequest,
  cwd: string,
  changeName: string,
  archived: boolean,
): Promise<ChangeTimeline> {
  const response = await request("/api/change-timeline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, changeName, archived }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<ChangeTimeline>;
}

export async function loadChangeTimelines(
  request: ChangeTimelineRequest,
  cwd: string,
  entries: ChangeTimelineEntry[],
): Promise<ChangeTimeline[]> {
  const response = await request("/api/change-timelines", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, entries }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<ChangeTimeline[]>;
}

/** Every change's proposed and archived dates and task counts, in one
 * pass — what the comparison draws before any history is read
 * (the-timeline-compares-changes). */
export async function loadChangeSpans(
  request: ChangeTimelineRequest,
  cwd: string,
): Promise<ChangeSpans> {
  const response = await request("/api/change-spans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<ChangeSpans>;
}
