import type { SprintReport } from "@openspec-ui/core/browser";

export interface SprintReportEntry {
  changeName: string;
  archived: boolean;
}

export type SprintReportRequest = (pathname: string, init: RequestInit) => Promise<Response>;

async function responseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? `${response.status} ${response.statusText}`;
}

/** Fetches the sprint summary. Drawing it as a page, opening it and
 * printing it are the caller's: that part is DOM-specific and not
 * meaningfully unit-testable the way this network call is
 * (the-sprint-report-is-a-page-of-the-product). */
export async function fetchSprintReport(
  request: SprintReportRequest,
  cwd: string,
  entries: SprintReportEntry[],
  rangeStart: string,
  rangeEnd: string,
): Promise<SprintReport> {
  const response = await request("/api/sprint-report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, entries, rangeStart, rangeEnd }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<SprintReport>;
}
