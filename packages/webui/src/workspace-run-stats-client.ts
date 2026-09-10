// The workspace's recorded run figures, over HTTP.
//
// The figures come from `.openspec-ui/audit.jsonl` and from which changes
// still exist, and this shell can read neither — which was twice taken as
// a reason not to show them. It is a real limit here, unlike the task
// list, which turned out to have been available all along. So there is a
// route, and it is worth its cost because the figures are the point of
// the box that shows them.

export type { WorkspaceRunStats, AgentRunGroup, VerifyQuality } from "@openspec-ui/core/browser";
import type { VerifyQuality, WorkspaceRunStats } from "@openspec-ui/core/browser";

/** The figures and what the verifying stages found, from one read of the
 * same log. */
export interface WorkspaceRunStatsResult extends WorkspaceRunStats {
  quality: VerifyQuality;
}

export type WorkspaceRunStatsRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export async function loadWorkspaceRunStats(
  request: WorkspaceRunStatsRequest,
  cwd: string,
): Promise<WorkspaceRunStatsResult> {
  const response = await request("/api/workspace-run-stats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<WorkspaceRunStatsResult>;
}
