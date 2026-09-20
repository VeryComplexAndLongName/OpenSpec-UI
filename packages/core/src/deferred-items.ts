// Judgements that outlive the change that raised them
// (a-change-lands-with-nothing-open).
//
// An item that asks about the shipped thing cannot be answered before
// the thing ships, and holding its change open until somebody answers
// is what left six changes active for a day on 2026-09-20.
//
// So such an item is closed in its change - marked deferred, which is a
// record of what happened - and the open question moves here, to one
// file the inbox always reads.
//
// Why it moves rather than being read from the archive: this repository
// has 285 archived changes, 1.76 MB of task lists. Measured on
// 2026-09-20, reading them all costs 309 ms and a `stat` pass over them
// alone costs 74 ms. That is a page load on every collection, for one
// deferred item. One small file costs one read, and it cannot go stale,
// because the archived line is a record and this is the question.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseTaskChecklist, type TaskChecklistItem } from "./task-checklist.js";

/** Where the list lives: beside the changes, one file for the whole
 * workspace. */
export function deferredListPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "openspec", "deferred.md");
}

export interface DeferredItem {
  /** What is to be judged. */
  text: string;
  /** The change that raised it, where the line says one. */
  fromChange?: string;
  /** Zero-based, as the checklist reports it: what a host needs to open
   * the file at the line. */
  lineNumber: number;
  done: boolean;
}

/** The change a line names, written as `(from <change-id>)` at its end.
 * Absent where the line names none: a question with no change behind it
 * is still a question. */
const FROM_LEAD = "(from ";

function fromChangeOf(text: string): string | undefined {
  const at = text.lastIndexOf(FROM_LEAD);
  if (at === -1) return undefined;
  const rest = text.slice(at + FROM_LEAD.length);
  const close = rest.indexOf(")");
  if (close === -1) return undefined;
  const named = rest.slice(0, close).trim();
  return named.length > 0 ? named : undefined;
}

/** Every deferred question, open and closed. A workspace with no list
 * has none, which is not a failure: the file appears the first time
 * something is deferred. */
export async function readDeferredItems(workspaceRoot: string): Promise<DeferredItem[]> {
  let content: string;
  try {
    content = await readFile(deferredListPath(workspaceRoot), "utf8");
  } catch {
    return [];
  }
  return parseTaskChecklist(content).map((item: TaskChecklistItem) => {
    const fromChange = fromChangeOf(item.text);
    return {
      text: item.text,
      lineNumber: item.lineNumber,
      done: item.done,
      ...(fromChange !== undefined ? { fromChange } : {}),
    };
  });
}

/** Adds a question to the list, naming the change it came from.
 *
 * Appends: the list is read by people as well as by this product, and a
 * rewritten file loses whatever somebody wrote around it. A file that
 * does not exist is started with its heading. */
export async function deferItem(
  workspaceRoot: string,
  question: { text: string; fromChange: string },
): Promise<void> {
  const filePath = deferredListPath(workspaceRoot);
  const newline = String.fromCharCode(10);
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    content = [
      "# Deferred",
      "",
      "Judgements about shipped work, raised by a change and outliving it.",
      "Each line names the change it came from. Tick one when it has been",
      "judged (a-change-lands-with-nothing-open).",
      "",
    ].join(newline);
  }
  const ends = content.endsWith(newline) ? "" : newline;
  const line = `- [ ] ${question.text} (from ${question.fromChange})${newline}`;
  await writeFile(filePath, content + ends + line, "utf8");
}
