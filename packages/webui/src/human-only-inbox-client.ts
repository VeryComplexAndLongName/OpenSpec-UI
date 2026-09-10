// What is waiting on a person, over HTTP.
//
// The collector reads every active change's `tasks.md`, so the browser
// cannot call it. See human-only-inbox-in-the-shell.

import type { HumanOnlyInbox } from "@openspec-ui/core/browser";

export type { HumanOnlyInbox };

export type HumanOnlyInboxRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export async function loadHumanOnlyInbox(
  request: HumanOnlyInboxRequest,
  cwd: string,
): Promise<HumanOnlyInbox> {
  const response = await request("/api/human-only-inbox", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<HumanOnlyInbox>;
}
