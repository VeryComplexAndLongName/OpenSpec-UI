// A change's uncommitted diff, over HTTP (a-screen-says-what-it-is-doing).
//
// Read in core against HEAD, untracked files included, so the browser derives
// nothing. A refusal — a name that is not an active change, a workspace that
// is not a repository — arrives as the server's own sentence, which the tab
// shows as it is.

export interface ChangeDiffAnswer {
  diff: string;
  files: string[];
  truncated: boolean;
  maxBytes: number;
}

export type ChangeDiffRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export async function loadChangeDiff(
  request: ChangeDiffRequest,
  cwd: string,
  changeName: string,
): Promise<ChangeDiffAnswer> {
  const response = await request("/api/change-diff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, changeName }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<ChangeDiffAnswer>;
}
