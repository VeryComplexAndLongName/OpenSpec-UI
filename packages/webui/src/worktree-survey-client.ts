// Every working directory of the repository, and what its runs say, over
// HTTP — what-the-others-are-doing.
//
// The survey lists git worktrees and reads each directory's files, so the
// browser cannot produce it. It asks and derives nothing: the wording it
// shows comes from core's `describeDirectoryRuns`, the same words the
// other surfaces use.

import type { WorktreeSurvey } from "@openspec-ui/core/browser";

export type { WorktreeSurvey };

export type WorktreeSurveyRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export async function loadWorktreeSurvey(request: WorktreeSurveyRequest, cwd: string): Promise<WorktreeSurvey> {
  const response = await request("/api/worktree-survey", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<WorktreeSurvey>;
}
