// A change a card names, as a row of the Changes tree carries it, so a card's
// action runs the same command a row's does (ADR 0044,
// a-change-is-acted-on-from-its-card). The row knows where the change is
// worked, and the command acts there.

import path from "node:path";
import {
  changeOwnership,
  discoverOpenSpecWorkspace,
  surveyWorktrees,
  workedElsewhere,
  type WorktreeSurvey,
} from "@openspec-ui/core";
import { ChangeTreeItem } from "./tree/changes-tree.js";

export interface ChangeItemSources {
  /** Test seam for the survey. */
  survey?: (workspaceRoot: string) => Promise<WorktreeSurvey>;
}

/** The change named, with this checkout's copy where it has one and where
 * it is worked; where only its own working directory has it - a change
 * proposed there is not in this checkout until its pull request merges -
 * that directory's copy. `undefined` for a name that is neither. */
export async function changeItemNamed(workspaceRoot: string, changeName: string, sources: ChangeItemSources = {}): Promise<ChangeTreeItem | undefined> {
  // A survey that could not be taken leaves the change reading as nobody's,
  // which is what this checkout can honestly say.
  const survey = await (sources.survey ?? ((root: string) => surveyWorktrees({ workspaceRoot: root })))(workspaceRoot).catch(() => undefined);
  const ownership = changeOwnership(changeName, survey);
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot, { changes: "active", drafts: true });
  const here = workspace.changes.find((change) => change.name === changeName);
  if (here !== undefined) {
    return new ChangeTreeItem(here.name, here.path, here.state, here.artifacts, false, undefined, here.schema, ownership);
  }
  const there = workedElsewhere(ownership);
  if (there === undefined) return undefined;
  return new ChangeTreeItem(changeName, path.join(there.path, "openspec", "changes", changeName), "in-progress", [], false, undefined, undefined, ownership);
}
