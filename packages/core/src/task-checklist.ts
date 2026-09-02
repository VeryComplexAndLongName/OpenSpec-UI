import { readFile, stat, writeFile } from "node:fs/promises";
import { isMechanicalCheckName, MECHANICAL_CHECK_NAMES, type MechanicalCheckName } from "./mechanical-checks.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";

// See openspec/changes/tasks-tree-expand/design.md. Paths always come
// from `discoverOpenSpecWorkspace`'s own allowlisted `artifacts[]`, never
// from joining a caller-supplied `changeName` onto a directory — same
// pattern `task-templates.ts`'s `readArchivedChangeTasksTemplate` already
// establishes.

/** A mechanical check a task line declares, plus its optional parameter —
 * see openspec/changes/harness-mechanical-checks/design.md, "The check is
 * a name from a registry, not a command line". `name` is always one of
 * `MECHANICAL_CHECK_NAMES`; a task naming anything else fails to parse
 * (`UnknownMechanicalCheckError`) rather than silently becoming an
 * ordinary, unchecked task. */
export interface TaskCheckDeclaration {
  name: MechanicalCheckName;
  param?: string;
}

export interface TaskChecklistItem {
  /** 0-indexed line number within tasks.md. */
  lineNumber: number;
  text: string;
  done: boolean;
  /** Present only when this task's line carries a `` `check(...)` ``
   * declaration — see `TASK_CHECK_DECLARATION_RE` below. Absent for
   * every task written before this capability existed, and for any task
   * that simply doesn't use the syntax. */
  check?: TaskCheckDeclaration;
}

/** A task names a check the registry (`mechanical-checks.ts`) does not
 * define — task 2.3: reported as a parse error naming the unknown name
 * and listing the valid ones, never silently ignored (a misspelled check
 * quietly becoming an ordinary task is exactly the failure this
 * capability exists to remove). */
export class UnknownMechanicalCheckError extends Error {
  constructor(name: string) {
    super(`Unknown mechanical check "${name}" (expected one of: ${MECHANICAL_CHECK_NAMES.join(", ")})`);
    this.name = "UnknownMechanicalCheckError";
  }
}

/** A `path-unchanged` declaration's parameter is syntactically invalid —
 * absolute, or containing a `..` traversal segment — independent of any
 * workspace root (which this module doesn't have; the full, root-aware
 * check that mirrors `checkCwdSandbox` lives in `mechanical-checks.ts`
 * and runs when the check actually executes). Rejecting the obviously
 * bad shape here means a `tasks.md` typo is caught at parse time, not
 * only when `verify` eventually runs the check. */
export class InvalidMechanicalCheckParameterError extends Error {
  constructor(name: MechanicalCheckName, param: string, reason: string) {
    super(`Invalid parameter for check "${name}" ("${param}"): ${reason}`);
    this.name = "InvalidMechanicalCheckParameterError";
  }
}

/** Matches a task's optional trailing check declaration: an inline-code
 * span `` `check(name)` `` or `` `check(name, param)` `` at the very end
 * of the task's text — see design.md's Open Question, "the exact syntax a
 * task uses to name its check". Chosen because it (a) never interacts
 * with `TASK_CHECKBOX_LINE_RE`, which only ever splits on the leading
 * `- [ ]`/`- [x]` marker and takes everything else as free text, and (b)
 * renders as ordinary Markdown inline code in a plain viewer, not as
 * something that reads as executable. */
export const TASK_CHECK_DECLARATION_RE = /`check\(([a-z][a-z0-9-]*)(?:,\s*(.+?))?\)`\s*$/;

function isSyntacticallySafeRelativePath(candidate: string): boolean {
  if (candidate.length === 0) return false;
  if (candidate.startsWith("/") || candidate.startsWith("\\")) return false;
  if (/^[A-Za-z]:[/\\]/.test(candidate)) return false; // Windows drive-absolute, e.g. "C:\..."
  return candidate.split(/[/\\]+/).every((segment) => segment !== "..");
}

/** Parses a task's trailing `` `check(...)` `` declaration, if present.
 * Returns `undefined` for a task with none — parses exactly as today
 * (task 2.2). Throws `UnknownMechanicalCheckError` for a name outside
 * `MECHANICAL_CHECK_NAMES`, and `InvalidMechanicalCheckParameterError`
 * for a `path-unchanged` parameter that is syntactically unsafe. */
export function parseTaskCheckDeclaration(text: string): TaskCheckDeclaration | undefined {
  const match = text.match(TASK_CHECK_DECLARATION_RE);
  if (!match) return undefined;

  const name = match[1] ?? "";
  if (!isMechanicalCheckName(name)) {
    throw new UnknownMechanicalCheckError(name);
  }

  const param = match[2]?.trim();
  if (name === "path-unchanged") {
    if (!param) {
      throw new InvalidMechanicalCheckParameterError(name, "", "path-unchanged requires a repository-relative path parameter");
    }
    if (!isSyntacticallySafeRelativePath(param)) {
      throw new InvalidMechanicalCheckParameterError(name, param, "must be a repository-relative path, not absolute and not containing \"..\"");
    }
  }

  return param ? { name, param } : { name };
}

export class TaskListChangedError extends Error {
  constructor(changeName: string) {
    super(`Task list for ${changeName} has changed since it was last loaded — refresh and try again.`);
    this.name = "TaskListChangedError";
  }
}

/** Matches a checklist line (`- [ ] text` / `- [x] text`); group 1 is the
 * check state, group 2 is the task text. Exported so callers needing the
 * exact same parsing convention (e.g. the VS Code reveal command) don't
 * duplicate a second, potentially-drifting copy of this regex. */
export const TASK_CHECKBOX_LINE_RE = /^[ \t]*-\s\[([ xX])\]\s*(.*)$/;

async function findTasksArtifactPath(
  workspaceRoot: string,
  changeName: string,
  archived: boolean,
): Promise<string | undefined> {
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  const list = archived ? workspace.archivedChanges : workspace.changes;
  const change = list.find((c) => c.name === changeName);
  const tasksArtifact = change?.artifacts.find((artifact) => artifact.id === "tasks");
  return tasksArtifact?.exists ? tasksArtifact.path : undefined;
}

function parseChecklist(content: string): TaskChecklistItem[] {
  const items: TaskChecklistItem[] = [];
  content.split(/\r?\n/).forEach((line, lineNumber) => {
    const match = line.match(TASK_CHECKBOX_LINE_RE);
    if (!match) return;
    const text = (match[2] ?? "").trim();
    const done = (match[1] ?? "").toLowerCase() === "x";
    const check = parseTaskCheckDeclaration(text);
    items.push(check ? { lineNumber, text, done, check } : { lineNumber, text, done });
  });
  return items;
}

/** Returns `[]` if the change or its tasks.md does not exist — reading a
 * task list is not an error-worthy condition the way deleting from one
 * that changed underneath the caller is (see `deleteTaskLine`). */
export async function readTaskChecklist(
  workspaceRoot: string,
  changeName: string,
  archived: boolean,
): Promise<TaskChecklistItem[]> {
  const tasksPath = await findTasksArtifactPath(workspaceRoot, changeName, archived);
  if (!tasksPath) return [];
  const content = await readFile(tasksPath, "utf8");
  return parseChecklist(content);
}

/** One mechanical-check result to write back onto its own checkbox line —
 * see openspec/changes/harness-mechanical-checks/design.md, "A check's
 * result is written to the checkbox, and nothing else may". */
export interface TaskCheckStateUpdate {
  lineNumber: number;
  /** Re-verified against the line's current text before writing, exactly
   * like `deleteTaskLine`'s own re-verification — a line whose text no
   * longer matches is left untouched rather than blindly overwritten. */
  expectedText: string;
  done: boolean;
}

/** Writes each update's pass/fail result onto its own checkbox — `[x]`
 * for a pass, `[ ]` for a fail — and nothing else on that line. Only this
 * function (called by `HarnessChainRunner`'s `verify` stage) ever writes
 * a mechanical check's result; an agent's own report never reaches
 * tasks.md through this path. An update whose `lineNumber` no longer
 * holds a checklist item with the expected text is silently skipped
 * (the task list changed underneath the caller — same reasoning as
 * `deleteTaskLine`), rather than aborting every other update in the
 * batch. */
export async function writeTaskCheckStates(
  workspaceRoot: string,
  changeName: string,
  archived: boolean,
  updates: readonly TaskCheckStateUpdate[],
): Promise<void> {
  if (updates.length === 0) return;
  const tasksPath = await findTasksArtifactPath(workspaceRoot, changeName, archived);
  if (!tasksPath) throw new TaskListChangedError(changeName);

  const content = await readFile(tasksPath, "utf8");
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);

  for (const update of updates) {
    const line = lines[update.lineNumber];
    const match = line?.match(TASK_CHECKBOX_LINE_RE);
    if (!match || (match[2] ?? "").trim() !== update.expectedText) continue;
    const newState = update.done ? "x" : " ";
    lines[update.lineNumber] = (line as string).replace(/^([ \t]*-\s\[)[ xX](\])/, `$1${newState}$2`);
  }

  await writeFile(tasksPath, lines.join(eol), "utf8");
}

/** Re-reads tasks.md fresh and verifies `lineNumber` still holds a
 * checklist item whose text exactly matches `expectedText` before
 * removing it — never trusts a caller-supplied line number blindly (see
 * design.md, "deleteTaskLine re-verifies..."). Throws
 * `TaskListChangedError` (not a generic error) if the change, its
 * tasks.md, or that specific line no longer matches what was expected. */
export async function deleteTaskLine(
  workspaceRoot: string,
  changeName: string,
  archived: boolean,
  lineNumber: number,
  expectedText: string,
): Promise<void> {
  const tasksPath = await findTasksArtifactPath(workspaceRoot, changeName, archived);
  if (!tasksPath) throw new TaskListChangedError(changeName);

  const content = await readFile(tasksPath, "utf8");
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const line = lines[lineNumber];
  const match = line?.match(TASK_CHECKBOX_LINE_RE);
  if (!match || (match[2] ?? "").trim() !== expectedText) {
    throw new TaskListChangedError(changeName);
  }

  lines.splice(lineNumber, 1);
  await writeFile(tasksPath, lines.join(eol), "utf8");
}

export interface ArchivedChangeSummary {
  completedTasks: number;
  totalTasks: number;
  /** ISO timestamp: `tasks.md`'s mtime, or the change directory's mtime
   * if it has no `tasks.md`. Best-effort — see design.md's "Risks"; not
   * guaranteed to share a source with active changes' CLI-reported
   * `lastModified`. */
  lastModified: string;
}

/** Progress summary for an *archived* change, for callers (like the
 * standalone overview) that need more than the name
 * `discoverOpenSpecWorkspace` alone provides. Reuses this file's own
 * checklist parsing rather than adding a third checkbox-counting
 * implementation alongside `change-state.ts`'s separate counter. Returns
 * `{0, 0}` with an epoch timestamp for an unknown change name — callers
 * are expected to only pass names already listed in
 * `discoverOpenSpecWorkspace`'s `archivedChanges`. */
export async function getArchivedChangeSummary(
  workspaceRoot: string,
  changeName: string,
): Promise<ArchivedChangeSummary> {
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  const change = workspace.archivedChanges.find((c) => c.name === changeName);
  const tasksArtifact = change?.artifacts.find((artifact) => artifact.id === "tasks");
  const tasksPath = tasksArtifact?.exists ? tasksArtifact.path : undefined;

  const items = tasksPath ? parseChecklist(await readFile(tasksPath, "utf8")) : [];
  const completedTasks = items.filter((item) => item.done).length;
  const totalTasks = items.length;

  const statPath = tasksPath ?? change?.path;
  const lastModified = statPath ? (await stat(statPath)).mtime.toISOString() : new Date(0).toISOString();

  return { completedTasks, totalTasks, lastModified };
}
