// Running the mechanical checks a change's `tasks.md` declares, without
// deciding what to do with the results — see ADR 0019 for the closed
// registry these names come from.
//
// Extracted from `harness-chain-runner.ts`, which had this inline and
// wrote each result straight onto its own checkbox. The two callers now
// differ in exactly that last step: the `verify` stage runs the checks as
// part of a run and writes what they found (it is the only writer of
// those checkboxes), while `openspec-ui-cli check` runs them as a
// question and writes nothing. A checkbox says "this task's check passed
// during a run"; asking whether the checks pass right now is not a run,
// and answering it should not tick anything.

import path from "node:path";
import { runMechanicalCheck, type MechanicalCheckContext, type MechanicalCheckResult } from "./mechanical-checks.js";
import { readTaskChecklist, tasksFilePath, type TaskCheckDeclaration } from "./task-checklist.js";

export interface DeclaredCheckOutcomeEntry {
  /** The task line that declared the check, as written. */
  text: string;
  /** Which line of `tasks.md` it is, so a caller that writes results back
   * can find it without re-parsing. */
  lineNumber: number;
  check: TaskCheckDeclaration;
  result: MechanicalCheckResult;
}

export interface DeclaredCheckRunOutcome {
  /** `false` when the change's `tasks.md` declares no checks at all.
   * Distinct from "every check passed" on purpose: a caller reporting to
   * a person must be able to say "none declared" rather than presenting
   * an empty pass as a pass. */
  ranAny: boolean;
  passed: DeclaredCheckOutcomeEntry[];
  failed: DeclaredCheckOutcomeEntry[];
}

/** Runs every mechanical check the change's `tasks.md` declares, in the
 * order the file lists them, and returns what each one found.
 *
 * Writes nothing. Reading and parsing `tasks.md` is what throws
 * `UnknownMechanicalCheckError`/`InvalidMechanicalCheckParameterError` for
 * a malformed declaration (task-checklist.ts); those are not caught here,
 * so a malformed `tasks.md` fails a caller exactly as a failing check
 * would. */
export async function runDeclaredChecks(
  workspaceRoot: string,
  changeName: string,
  archived = false,
  scripts?: MechanicalCheckContext["scripts"],
): Promise<DeclaredCheckRunOutcome> {
  const items = await readTaskChecklist(workspaceRoot, changeName, archived);
  const withChecks = items.filter((item) => item.check !== undefined);
  if (withChecks.length === 0) return { ranAny: false, passed: [], failed: [] };

  // The change directory comes from the `tasks.md` this workspace's own
  // discovery found, not from joining a caller-supplied change name onto
  // a directory — the rule task-checklist.ts's header states, and the
  // reason `tasksFilePath` is exported at all. Reaching here means the
  // checklist was read, so the path exists.
  const tasksPath = await tasksFilePath(workspaceRoot, changeName, archived);
  if (tasksPath === undefined) return { ranAny: false, passed: [], failed: [] };
  const changeDir = path.dirname(tasksPath);
  const ctx: MechanicalCheckContext = { workspaceRoot, changeDir, changeName, ...(scripts ? { scripts } : {}) };
  const passed: DeclaredCheckOutcomeEntry[] = [];
  const failed: DeclaredCheckOutcomeEntry[] = [];

  for (const item of withChecks) {
    const check = item.check as TaskCheckDeclaration;
    const result = await runMechanicalCheck(check.name, check.param, ctx);
    (result.pass ? passed : failed).push({ text: item.text, lineNumber: item.lineNumber, check, result });
  }

  return { ranAny: true, passed, failed };
}
