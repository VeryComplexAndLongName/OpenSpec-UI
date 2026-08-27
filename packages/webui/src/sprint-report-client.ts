export interface SprintReportEntry {
  changeName: string;
  archived: boolean;
}

export type SprintReportRequest = (pathname: string, init: RequestInit) => Promise<Response>;

async function responseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? `${response.status} ${response.statusText}`;
}

/** Fetches the sprint report PDF as a `Blob` — triggering the actual
 * browser download (an object URL + a temporary `<a download>`) is left
 * to the caller, since that part is DOM-specific and not meaningfully
 * unit-testable the way this network call is. */
export async function fetchSprintReportPdf(
  request: SprintReportRequest,
  cwd: string,
  entries: SprintReportEntry[],
  rangeStart: string,
  rangeEnd: string,
): Promise<Blob> {
  const response = await request("/api/sprint-report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, entries, rangeStart, rangeEnd }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.blob();
}
