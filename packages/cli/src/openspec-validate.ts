// Core-consuming validation logic, no argv/exit-code concerns — see
// openspec/changes/ci-cli/design.md, "Per-change validation failure vs.
// tool-level failure are distinguished, not conflated". `listChanges()`
// only ever returns active (non-archived) changes, so no extra filtering
// is needed here.

import { isUnrecordedTask, listChanges, readTaskChecklist, taskNumberOf, validateChange } from "@openspec-ui/core";

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
}

async function validateOne(id: string, cwd: string): Promise<ChangeValidationResult> {
  try {
    const result = await validateChange(id, { cwd });
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

/** What a change's task list still owes, for the change a pull request
 * is for and for no other (a-change-lands-with-nothing-open).
 *
 * A pull request for change A must not fail because change B, merged
 * this morning and waiting on its owner, has an item open: that is the
 * ordinary state of this repository, not a fault in A. */
async function taskDebts(cwd: string, changeName: string): Promise<{ open: string[]; unrecorded: string[] }> {
  const items = await readTaskChecklist(cwd, changeName, false);
  const say = (item: { text: string }): string => {
    const number = taskNumberOf(item.text);
    return number === undefined ? item.text : `${number} ${item.text.slice(number.length).trim()}`;
  };
  return {
    open: items.filter((item) => !item.done).map(say),
    unrecorded: items.filter((item) => isUnrecordedTask(item)).map(say),
  };
}

export async function runValidateAll(cwd: string, options: { change?: string } = {}): Promise<ValidateAllResult> {
  const { changes } = await listChanges({ cwd });
  const results = await Promise.all(changes.map((change) => validateOne(change.name, cwd)));

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

  return { ok: results.every((result) => result.valid), results };
}
