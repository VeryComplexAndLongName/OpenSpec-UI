// What the workspace was left holding, over HTTP
// (the-workspace-clears-what-it-left-behind).
//
// The reading sweeps first, as the survey's reading sweeps stale status
// records: the host that asks what is there is the host that would have
// had to ask for the clearing too. The browser decides nothing about
// which directory may go - core does, and the removal is a second call
// made only because somebody pressed for it.

export interface WorkspaceLeftoverReading {
  /** Names of the directories the sweep removed. */
  cleared: Array<{ name: string; path: string; files: string[]; archivedAs?: string }>;
  /** Directories with no documents the sweep will not remove by itself. */
  kept: Array<{ name: string; path: string; files: string[]; archivedAs?: string }>;
  /** A directory the sweep could not remove, with why. */
  failures: Array<{ name: string; path: string; reason: string }>;
  /** Working directories with nothing left to do. */
  finishedWith: Array<{ path: string; label: string; branch?: string; reason?: "merged" | "branch-gone" }>;
}

export type LeftoversRequest = (pathname: string, init: RequestInit) => Promise<Response>;

async function post<T>(request: LeftoversRequest, pathname: string, body: unknown): Promise<T> {
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

export async function loadWorkspaceLeftovers(
  request: LeftoversRequest,
  cwd: string,
): Promise<WorkspaceLeftoverReading> {
  return post<WorkspaceLeftoverReading>(request, "/api/workspace-leftovers", { cwd });
}

/** Removes one leftover directory, or one working directory. Exactly one
 * of `name` and `path` is given, which is what the route accepts. */
export async function removeWorkspaceLeftover(
  request: LeftoversRequest,
  cwd: string,
  target: { name: string } | { path: string },
): Promise<{ removed: string }> {
  return post<{ removed: string }>(request, "/api/workspace-leftovers/remove", { cwd, ...target });
}
