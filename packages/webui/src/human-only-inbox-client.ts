// What is waiting on a person, over HTTP.
//
// The collector reads every active change's `tasks.md`, so the browser
// cannot call it. See human-only-inbox-in-the-shell.

import type { DelegatedItemRunResult, HumanOnlyInbox } from "@openspec-ui/core/browser";

export type { DelegatedItemRunResult, HumanOnlyInbox };

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

/** Runs the agent one open delegated item names. One item per call,
 * asked for deliberately — see a-delegated-item-runs-its-agent.
 *
 * A refusal comes back as a 200 carrying the result: the server was
 * asked a legitimate question and answered it. Only a transport or
 * workspace failure is an error here. */
export async function runDelegatedItem(
  request: HumanOnlyInboxRequest,
  cwd: string,
  item: { changeName: string; lineNumber: number },
): Promise<DelegatedItemRunResult> {
  const response = await request("/api/delegated-item/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, changeName: item.changeName, lineNumber: item.lineNumber }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<DelegatedItemRunResult>;
}
