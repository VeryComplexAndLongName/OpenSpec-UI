// Core-consuming validation logic, no argv/exit-code concerns — see
// openspec/changes/ci-cli/design.md, "Per-change validation failure vs.
// tool-level failure are distinguished, not conflated". `listChanges()`
// only ever returns active (non-archived) changes, so no extra filtering
// is needed here.

import { listChanges, validateChange } from "@openspec-ui/core";

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

export async function runValidateAll(cwd: string): Promise<ValidateAllResult> {
  const { changes } = await listChanges({ cwd });
  const results = await Promise.all(changes.map((change) => validateOne(change.name, cwd)));
  return { ok: results.every((result) => result.valid), results };
}
