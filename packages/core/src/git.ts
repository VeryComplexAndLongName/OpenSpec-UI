// Тонкая git-обёртка — только то, что реально нужно UI (статус, diff, commit,
// branch), не полный API git (см. tasks.md 5.2). Поверх `simple-git`.

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
    async currentBranch(): Promise<string> {
      const s = await git.status();
      return s.current ?? "";
    },
  };
}
