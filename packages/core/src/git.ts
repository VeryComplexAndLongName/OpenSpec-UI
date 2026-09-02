// Thin git wrapper — only what the UI actually needs (status, diff, commit,
// branch), not the full git API (see tasks.md 5.2). Built on top of `simple-git`.

import simpleGit, { type SimpleGit } from "simple-git";

export interface GitWrapperOptions {
  cwd: string;
}

export interface GitStatusSummary {
  current: string | null;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  notAdded: string[];
  deleted: string[];
  isClean: boolean;
}

export interface GitWrapper {
  status(): Promise<GitStatusSummary>;
  diff(pathspec?: string): Promise<string>;
  commit(message: string): Promise<{ commit: string }>;
  /** Takes the remote and branch explicitly: the git stage checks an
   * invocation against its allowlist and audits it before calling this,
   * and the command that runs has to be the command that was checked. A
   * bare `git push` resolves both from the branch's upstream — which may
   * differ from what was checked, and does not exist at all on a branch
   * that has never been pushed. */
  push(remote: string, branch: string): Promise<void>;
  currentBranch(): Promise<string>;
}

export function createGitWrapper(options: GitWrapperOptions): GitWrapper {
  const git: SimpleGit = simpleGit(options.cwd);

  return {
    async status(): Promise<GitStatusSummary> {
      const s = await git.status();
      return {
        current: s.current,
        ahead: s.ahead,
        behind: s.behind,
        staged: s.staged,
        modified: s.modified,
        notAdded: s.not_added,
        deleted: s.deleted,
        isClean: s.isClean(),
      };
    },
    async diff(pathspec?: string): Promise<string> {
      return pathspec ? git.diff([pathspec]) : git.diff();
    },
    async commit(message: string): Promise<{ commit: string }> {
      const result = await git.commit(message);
      return { commit: result.commit };
    },
    async push(remote: string, branch: string): Promise<void> {
      // No extra flags: `buildGitPushInvocation` renders exactly
      // `git push <remote> <branch>`, and that argv is what the git
      // stage's allowlist checked and its audit recorded.
      await git.push(remote, branch);
    },
    async currentBranch(): Promise<string> {
      const s = await git.status();
      return s.current ?? "";
    },
  };
}
