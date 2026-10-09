// Where an action on a change runs, found by the host from the repository's
// own worktree list, never from a request (ADR 0044, a-change-is-acted-on-
// from-its-card): the change's own working directory where it is worked in
// another one, and this checkout otherwise.

import path from "node:path";
import { changeOwnership, refuseToWrite, workedElsewhere, type ChangeOwnership } from "./change-ownership.js";
import { InvalidChangeNameError, isValidChangeName } from "./change-name.js";
import type { WorktreeSurvey } from "./worktree-survey-facts.js";
import { surveyWorktrees } from "./worktree-survey.js";

export interface ChangeActionRoot {
  /** The working directory the action runs in. */
  root: string;
  /** The change's directory there. */
  changeDir: string;
  ownership: ChangeOwnership;
  /** Why a writing action is refused, where the directory's records do not
   * check out. */
  refusal?: string;
}

export async function changeActionRoot(
  workspaceRoot: string,
  changeName: string,
  sources: { survey?: (workspaceRoot: string) => Promise<WorktreeSurvey> } = {},
): Promise<ChangeActionRoot> {
  if (!isValidChangeName(changeName)) throw new InvalidChangeNameError(changeName);
  // A survey that could not be taken leaves the change reading as nobody's,
  // which is what this checkout can honestly say.
  const survey = await (sources.survey ?? ((root: string) => surveyWorktrees({ workspaceRoot: root })))(workspaceRoot).catch(() => undefined);
  const ownership = changeOwnership(changeName, survey);
  const there = workedElsewhere(ownership);
  const root = there?.path ?? workspaceRoot;
  const refusal = refuseToWrite(changeName, ownership);
  return {
    root,
    changeDir: path.join(root, "openspec", "changes", changeName),
    ownership,
    ...(refusal !== undefined ? { refusal } : {}),
  };
}
