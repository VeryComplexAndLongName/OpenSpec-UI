// Where every change stands, over HTTP (a-change-says-where-it-stands).
//
// The reading lists refs and may fetch, so the browser cannot make it. What
// comes back is facts; the word for each change is `describeChangeState`'s,
// in the browser.

import type { ChangeStandings } from "@openspec-ui/core/browser";

export type ChangeStandingsRequest = (pathname: string, init: RequestInit) => Promise<Response>;

/** `interval` fetches refs only where they are older than the fetch interval;
 * `now` fetches them at once. */
export async function loadChangeStandings(
  request: ChangeStandingsRequest,
  cwd: string,
  fetch: "now" | "interval" = "interval",
): Promise<ChangeStandings> {
  const response = await request("/api/change-standings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, fetch }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<ChangeStandings>;
}
