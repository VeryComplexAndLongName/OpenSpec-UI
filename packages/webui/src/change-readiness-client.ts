// What can start now, over HTTP.
//
// The report is read by walking the changes directory, listing git
// worktrees and peeking at each one's lease, so the browser cannot
// produce it. It asks, and it derives nothing: the placement it draws
// comes from `layoutChanges` in core, which the terminal uses too, so
// the tab and `openspec-ui-cli ready` cannot disagree (ADR 0025).

import type { ChangeReadinessReport } from "@openspec-ui/core/browser";

export type { ChangeReadinessReport };

export type ChangeReadinessRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export async function loadChangeReadiness(
  request: ChangeReadinessRequest,
  cwd: string,
): Promise<ChangeReadinessReport> {
  const response = await request("/api/change-readiness", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<ChangeReadinessReport>;
}
