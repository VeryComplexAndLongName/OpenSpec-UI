import { readFile, writeFile } from "node:fs/promises";
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
