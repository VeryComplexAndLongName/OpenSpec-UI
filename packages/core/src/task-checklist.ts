import { readFile, stat, writeFile } from "node:fs/promises";
import { discoverOpenSpecWorkspace } from "./workbench.js";

// See openspec/changes/tasks-tree-expand/design.md. Paths always come
// from `discoverOpenSpecWorkspace`'s own allowlisted `artifacts[]`, never
// from joining a caller-supplied `changeName` onto a directory — same
// pattern `task-templates.ts`'s `readArchivedChangeTasksTemplate` already
// establishes.

export interface TaskChecklistItem {
  /** 0-indexed line number within tasks.md. */
  lineNumber: number;
  text: string;
  done: boolean;
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
    items.push({ lineNumber, text: (match[2] ?? "").trim(), done: (match[1] ?? "").toLowerCase() === "x" });
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
