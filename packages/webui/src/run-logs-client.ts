import type { RunLogRecord, RunLogSummary } from "@openspec-ui/core/browser";

// The standalone's reads of a change's run logs (a-change-shows-its-run-logs).

export type RunLogsRequest = (pathname: string, init: RequestInit) => Promise<Response>;

async function post<T>(request: RunLogsRequest, pathname: string, body: unknown): Promise<T> {
  const response = await request(pathname, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function listChangeRunLogs(request: RunLogsRequest, cwd: string, changeName: string): Promise<RunLogSummary[]> {
  return post(request, "/api/run-logs/list", { cwd, changeName });
}

export function readChangeRunLog(request: RunLogsRequest, cwd: string, runId: string): Promise<RunLogRecord[]> {
  return post(request, "/api/run-logs/read", { cwd, runId });
}
