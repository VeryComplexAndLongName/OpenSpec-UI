// How far this checkout is behind what has landed, over HTTP
// (main-catches-up-with-what-landed).
//
// The reading counts commits and reads the tree, so the browser cannot
// make it. What comes back is facts; the words are `driftWords`, in the
// browser.

import type { CatchUpResult, MainDrift } from "@openspec-ui/core/browser";

export type MainDriftRequest = (pathname: string, init: RequestInit) => Promise<Response>;

async function post<T>(request: MainDriftRequest, pathname: string, cwd: string): Promise<T> {
  const response = await request(pathname, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/** `undefined` where the repository cannot answer: no branch, no remote
 * ref, no git. */
export async function loadMainDrift(request: MainDriftRequest, cwd: string): Promise<MainDrift | undefined> {
  const payload = await post<{ drift: MainDrift | null }>(request, "/api/main-drift", cwd);
  return payload.drift ?? undefined;
}

/** A refusal comes back as an answer, not as a failure: the caller shows
 * `why` where the press was made. */
export async function catchUpWithMainOverHttp(request: MainDriftRequest, cwd: string): Promise<CatchUpResult> {
  return post<CatchUpResult>(request, "/api/main-drift/catch-up", cwd);
}
