// The OpenSpec setup goes to the server as soon as it is made
// (agents-are-told-how-work-is-done-here, ADR 0043).
//
// Every change is cut from the default branch as the server has it. In a
// repository just initialized that branch holds none of `openspec/` nor
// the rules, so an agent told to cut a change from it found nothing to cut
// from and stopped (2026-10-07). Initializing therefore offers to commit
// what initializing made, and only that, to the default branch, and push it.

import { createGitWrapper, type GitWrapper } from "./git.js";
import { DEFAULT_BRANCH, DEFAULT_REMOTE } from "./main-drift-facts.js";

/** What is not committed in a working directory, as git lists it. */
export type UncommittedPaths = ReadonlySet<string>;

/** The run state of this product: never part of a commit of the setup. */
const RUN_STATE = ".openspec-ui";

export type SetupCommitted =
  | { state: "pushed"; paths: string[]; commit: string }
  | { state: "committed"; paths: string[]; commit: string; reason: string }
  | { state: "nothing" }
  | { state: "not-on-default-branch"; branch: string }
  | { state: "no-remote" };

/** The paths not committed now: taken before initializing, so that what
 * a person had already changed is never swept into the setup's commit. */
export async function uncommittedPaths(git: Pick<GitWrapper, "status">): Promise<UncommittedPaths> {
  const status = await git.status();
  return new Set([...status.staged, ...status.modified, ...status.notAdded, ...status.deleted]);
}

/** Commits what initializing made - the paths not committed now that were
 * not already so `before` it - to the default branch, and pushes it. Does
 * nothing on another branch, or in a repository with no `origin`. A push
 * that is refused leaves the commit, and says why. */
export async function commitOpenSpecSetup(options: {
  repositoryRoot: string;
  before: UncommittedPaths;
  git?: GitWrapper;
}): Promise<SetupCommitted> {
  const git = options.git ?? createGitWrapper({ cwd: options.repositoryRoot });
  if (await git.remoteUrl(DEFAULT_REMOTE) === undefined) return { state: "no-remote" };
  const branch = await git.currentBranch();
  if (branch !== DEFAULT_BRANCH) return { state: "not-on-default-branch", branch };
  const now = await uncommittedPaths(git);
  const paths = [...now]
    .filter((entry) => !options.before.has(entry))
    .filter((entry) => entry !== RUN_STATE && !entry.startsWith(`${RUN_STATE}/`))
    .sort();
  if (paths.length === 0) return { state: "nothing" };
  for (const entry of paths) await git.stagePath(entry);
  const { commit } = await git.commit([
    "chore: set up OpenSpec",
    "",
    "Made by OpenSpec Workbench's Initialize: the OpenSpec setup and the",
    "rules for how work is done here, so that each change can be cut from",
    `${DEFAULT_REMOTE}/${DEFAULT_BRANCH} in a working directory of its own.`,
  ].join("\n"));
  try {
    await git.push(DEFAULT_REMOTE, DEFAULT_BRANCH);
    return { state: "pushed", paths, commit };
  } catch (error) {
    return { state: "committed", paths, commit, reason: error instanceof Error ? error.message.trim() : String(error) };
  }
}

/** What happened, in a sentence a host says. */
export function describeSetupCommitted(result: SetupCommitted): string {
  switch (result.state) {
    case "pushed":
      return `committed the OpenSpec setup (${result.paths.join(", ")}) to ${DEFAULT_BRANCH} and pushed it; each change can now be cut from ${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`;
    case "committed":
      return `committed the OpenSpec setup to ${DEFAULT_BRANCH}, but the push was refused (${result.reason}); push it before making a change`;
    case "nothing":
      return "there was nothing of the OpenSpec setup left to commit";
    case "not-on-default-branch":
      return `the OpenSpec setup was not committed: this checkout is on ${result.branch}, not ${DEFAULT_BRANCH}`;
    case "no-remote":
      return "the OpenSpec setup was not pushed: this repository has no origin";
  }
}
