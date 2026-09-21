// Core-consuming validation logic, no argv/exit-code concerns — see
// openspec/changes/ci-cli/design.md, "Per-change validation failure vs.
// tool-level failure are distinguished, not conflated". `listChanges()`
// only ever returns active (non-archived) changes, so no extra filtering
// is needed here.

import {
  createGitWrapper,
  describeTaskDebts,
  listChanges,
  owesNothing,
  readArchivedSince,
  readTaskChecklist,
  validateChange,
  type GitWrapper,
  type TaskDebts,
} from "@openspec-ui/core";

export interface ChangeValidationResult {
  id: string;
  valid: boolean;
  failedItems: number;
  totalItems: number;
  /** Why the change failed strict validation, as the underlying CLI
   * stated it. Present only for a change that was validated and found
   * invalid — a change that could not be validated at all carries
   * `error` instead, and the two are different findings. */
  issues?: string[];
  error?: string;
  /** Task items still open in the change this pull request is for, and
   * closed ones that claim a check with nothing written under them.
   * Present only for that change (a-change-lands-with-nothing-open). */
  openItems?: string[];
  unrecordedItems?: string[];
}

export interface ValidateAllResult {
  ok: boolean;
  results: ChangeValidationResult[];
  /** The changes this pull request archives that still owe something,
   * where a base was given (a-change-is-archived-with-nothing-open). */
  archived?: Array<{ archiveName: string; openItems?: string[]; unrecordedItems?: string[] }>;
  /** Why the archive could not be compared with the base, where it could
   * not. The gate fails then: a check that could not run is not one that
   * passed. */
  archiveCheckFailed?: string;
}

/** The two calls that spawn the `openspec` CLI. Seams, because the job
 * that runs the unit tests does not install that CLI - only the
 * merge-gate and extension jobs do - and a test about the open-item
 * rule should not need a process at all. CI found this with
 * `spawn openspec ENOENT` where this machine, which has the CLI
 * installed, said nothing (a-change-lands-with-nothing-open). */
export type ValidateChange = typeof validateChange;
export type ListChanges = typeof listChanges;

async function validateOne(id: string, cwd: string, run: ValidateChange): Promise<ChangeValidationResult> {
  try {
    const result = await run(id, { cwd });
    const issues = result.items
      .filter((item) => !item.valid)
      .flatMap((item) => item.issues.map((issue) => issue.message));
    return {
      id,
      valid: result.summary.totals.failed === 0,
      failedItems: result.summary.totals.failed,
      totalItems: result.summary.totals.items,
      // Carried only when there is something to carry: a passing change
      // with an empty array would read as "checked, nothing to say",
      // which is what the absent field already means.
      ...(issues.length > 0 ? { issues } : {}),
    };
  } catch (error) {
    return {
      id,
      valid: false,
      failedItems: 0,
      totalItems: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** What the change a pull request is for still owes. The rule is core's
 * (a-change-is-archived-with-nothing-open); this only reads the list.
 *
 * A pull request for change A must not fail because change B, merged
 * this morning and waiting on its owner, has an item open: that is the
 * ordinary state of this repository, not a fault in A. */
async function taskDebts(cwd: string, changeName: string): Promise<TaskDebts> {
  return describeTaskDebts(await readTaskChecklist(cwd, changeName, false));
}

export async function runValidateAll(
  cwd: string,
  options: {
    change?: string;
    /** The ref the pull request merges into. Every change it archives is
     * held to the same rule as the change it is for. */
    archivedSince?: string;
    validateChange?: ValidateChange;
    listChanges?: ListChanges;
    /** The git a base is read through. */
    git?: Pick<GitWrapper, "listTreeNames">;
  } = {},
): Promise<ValidateAllResult> {
  const run = options.validateChange ?? validateChange;
  const list = options.listChanges ?? listChanges;
  const { changes } = await list({ cwd });
  const results = await Promise.all(changes.map((change) => validateOne(change.name, cwd, run)));

  // The open-item rule applies to one change: the one the pull request
  // is for, which this repository names its branch after. A name no
  // active change has - an archive pull request, an article - is
  // skipped rather than guessed at.
  const named = options.change === undefined
    ? undefined
    : results.find((result) => result.id === options.change);
  if (named !== undefined && options.change !== undefined) {
    const debts = await taskDebts(cwd, options.change);
    if (debts.open.length > 0) named.openItems = debts.open;
    if (debts.unrecorded.length > 0) named.unrecordedItems = debts.unrecorded;
    if (debts.open.length > 0 || debts.unrecorded.length > 0) named.valid = false;
  }

  let archived: ValidateAllResult["archived"];
  let archiveCheckFailed: string | undefined;
  if (options.archivedSince !== undefined) {
    try {
      const found = await readArchivedSince(cwd, options.archivedSince, options.git ?? createGitWrapper({ cwd }));
      archived = found
        .filter((one) => !owesNothing(one.debts))
        .map((one) => ({
          archiveName: one.archiveName,
          ...(one.debts.open.length > 0 ? { openItems: one.debts.open } : {}),
          ...(one.debts.unrecorded.length > 0 ? { unrecordedItems: one.debts.unrecorded } : {}),
        }));
    } catch (error) {
      archiveCheckFailed = error instanceof Error ? error.message : String(error);
    }
  }

  const ok = results.every((result) => result.valid)
    && (archived === undefined || archived.length === 0)
    && archiveCheckFailed === undefined;
  return {
    ok,
    results,
    ...(archived !== undefined && archived.length > 0 ? { archived } : {}),
    ...(archiveCheckFailed !== undefined ? { archiveCheckFailed } : {}),
  };
}
