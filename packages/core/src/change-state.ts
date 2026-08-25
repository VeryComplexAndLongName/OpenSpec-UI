// Derived state machine for a change's status — the single place where this
// is computed (see ADR 0001 item 5, design.md "Derived state — a pure
// function").
//
// `deriveChangeState` itself is a pure function with no side effects: it
// takes the already-read contents of `tasks.md` (or `null` if the file is
// missing), rather than reading the filesystem itself. Reading the file is
// a separate wrapper (`readChangeState`) used by `server`/`extension`; the
// heuristic itself stays testable without disk access.

import { readFile } from "node:fs/promises";
import path from "node:path";

export type ChangeState = "draft" | "in-progress" | "implemented" | "archived";

function isArchived(changeDir: string): boolean {
  const segments = changeDir.split(/[\\/]+/).filter(Boolean);
  return segments.includes("archive");
}

interface TaskCounts {
  total: number;
  checked: number;
}

const TASK_CHECKBOX_RE = /^[ \t]*-\s\[( |x|X)\]/gm;

function countTasks(tasksMarkdown: string): TaskCounts {
  let total = 0;
  let checked = 0;
  for (const match of tasksMarkdown.matchAll(TASK_CHECKBOX_RE)) {
    total += 1;
    if (match[1]?.toLowerCase() === "x") checked += 1;
  }
  return { total, checked };
}

/**
 * Computes a change's status from its directory location and the contents
 * of `tasks.md` (or `null` if the file is missing/not yet created).
 *
 * - `archived` — the directory lives under `.../archive/...` (overrides
 *   everything else — it does not matter what is in an archived change's
 *   `tasks.md`);
 * - `draft` — `tasks.md` is missing, empty (no items), or no item is
 *   checked `[x]`;
 * - `implemented` — every item is checked `[x]`;
 * - `in-progress` — some items are checked.
 */
export function deriveChangeState(changeDir: string, tasksMarkdown: string | null): ChangeState {
  if (isArchived(changeDir)) return "archived";
  if (tasksMarkdown === null) return "draft";

  const { total, checked } = countTasks(tasksMarkdown);
  if (total === 0 || checked === 0) return "draft";
  if (checked === total) return "implemented";
  return "in-progress";
}

/** Convenience wrapper for real consumers: reads `tasks.md` from disk and
 * applies `deriveChangeState`. The file may be missing — that is not an
 * error, it is a signal of the `draft` state. */
export async function readChangeState(changeDir: string): Promise<ChangeState> {
  let tasksMarkdown: string | null;
  try {
    tasksMarkdown = await readFile(path.join(changeDir, "tasks.md"), "utf8");
  } catch {
    tasksMarkdown = null;
  }
  return deriveChangeState(changeDir, tasksMarkdown);
}
