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
  error?: string;
}

export interface ValidateAllResult {
  ok: boolean;
  results: ChangeValidationResult[];
}

async function validateOne(id: string, cwd: string): Promise<ChangeValidationResult> {
  try {
    const result = await validateChange(id, { cwd });
    return {
      id,
      valid: result.summary.totals.failed === 0,
      failedItems: result.summary.totals.failed,
      totalItems: result.summary.totals.items,
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
