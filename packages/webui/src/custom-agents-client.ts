// The custom agents a workspace defines, over HTTP.
//
// The discovery reads `.claude/agents` and `.github/agents`, so it
// imports `node:fs/promises` and this shell cannot call it — the same
// shape as the run figures, and the reason the picker needed a route
// before it could exist. See custom-agent-picker.
//
// The directories come back with the list because the empty list is the
// ordinary case: most workspaces define none, including this one, and
// "none, and here is where one would go" is the useful form of that.

import type { CustomAgent, CustomAgentFamily } from "@openspec-ui/core/browser";

export type { CustomAgent, CustomAgentFamily };

export interface CustomAgentDirectory {
  family: CustomAgentFamily;
  scope: "project" | "user";
  path: string;
}

export interface CustomAgentsResult {
  agents: CustomAgent[];
  directories: CustomAgentDirectory[];
}

export type CustomAgentsRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export async function loadCustomAgents(
  request: CustomAgentsRequest,
  cwd: string,
): Promise<CustomAgentsResult> {
  const response = await request("/api/custom-agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<CustomAgentsResult>;
}
