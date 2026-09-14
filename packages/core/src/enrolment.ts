// The enrolment requests of a workspace, and confirming one — the one place
// every host asks (ADR 0028, "Enrolment is one confirmation").
//
// The inbox, the standalone route, the editor's command and
// `openspec-ui-cli enrol` all call these, so which key a confirmation enrols
// is decided once.

import {
  collectEnrolmentRequests,
  confirmEnrolment,
  EnrolmentRefusedError,
  readAgentRoster,
  rosterDirectoryBeside,
  rosterOf,
  type AgentRosterEntry,
} from "./agent-roster.js";
import { readAgentStatuses, resolveAgentStatusDirectory } from "./agent-status.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import type { EnrolmentRequest } from "./signature-facts.js";
import type { WorktreeRootSources } from "./worktree-root.js";

export interface EnrolmentOptions {
  /** Test seam: the wrapper whose worktree list locates the status directory. */
  git?: Pick<GitWrapper, "worktreeList">;
  /** Test seam: where the worktree root is read from. */
  rootSources?: WorktreeRootSources;
  /** Test seam for the records' clock. */
  now?: () => Date;
}

export interface EnrolmentReading {
  requests: EnrolmentRequest[];
  /** Where a confirmation writes. */
  rosterDirectory: string;
}

/** Every key that signs a live record of this repository and is not
 * enrolled, with what a person needs to decide. */
export async function readEnrolmentRequests(workspaceRoot: string, options: EnrolmentOptions = {}): Promise<EnrolmentReading> {
  const git = options.git ?? createGitWrapper({ cwd: workspaceRoot });
  const statusDirectory = await resolveAgentStatusDirectory(git, workspaceRoot, options.rootSources ?? {});
  const rosterDirectory = rosterDirectoryBeside(statusDirectory);
  const roster = rosterOf((await readAgentRoster(rosterDirectory)).entries);
  const { reports } = await readAgentStatuses(statusDirectory, {
    roster,
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
  return { requests: collectEnrolmentRequests({ statuses: reports, roster }), rosterDirectory };
}

/** Enrols the key a waiting request names. Only a key that signs a live
 * record now can be enrolled this way: a key id nobody is using is refused,
 * so a confirmation is always about a run somebody can see. */
export async function confirmEnrolmentFor(
  workspaceRoot: string,
  keyId: string,
  options: EnrolmentOptions & { label?: string } = {},
): Promise<AgentRosterEntry> {
  const { requests, rosterDirectory } = await readEnrolmentRequests(workspaceRoot, options);
  const request = requests.find((candidate) => candidate.keyId === keyId);
  if (request === undefined) {
    throw new EnrolmentRefusedError(`no live run signed by ${keyId} is waiting to be enrolled`);
  }
  return await confirmEnrolment({
    rosterDirectory,
    request,
    ...(options.label !== undefined ? { label: options.label } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
}
