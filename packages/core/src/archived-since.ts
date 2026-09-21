// What a pull request archives, and what each of those still owes
// (a-change-is-archived-with-nothing-open).
//
// The merge gate's open-item rule names the change a branch is for, and
// an archive pull request names none - so on 2026-09-21 a change was
// archived with an item open and the gate said nothing. The changes a
// pull request archives are exactly the archive directories it adds, and
// they are read here from two listings: the working tree's, and the one
// on the ref it merges into.
//
// Two listings need no history between them, so a shallow checkout with
// the base fetched at depth one is enough. And only what was added is
// read: the 285 changes already archived are records of their time.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { GitWrapper } from "./git.js";
import { describeTaskDebts, parseTaskChecklist, type TaskDebts } from "./task-checklist.js";

const ARCHIVE = "openspec/changes/archive";

export interface ArchivedChangeDebts {
  /** The archive directory's name, `<date>-<change>`. */
  archiveName: string;
  debts: TaskDebts;
}

/** Every archive directory present here and absent from `ref`, with what
 * each still owes. Throws where `ref` cannot be read: a comparison that
 * could not be made is not one that found nothing. */
export async function readArchivedSince(
  workspaceRoot: string,
  ref: string,
  git: Pick<GitWrapper, "listTreeNames">,
): Promise<ArchivedChangeDebts[]> {
  const onBase = new Set(await git.listTreeNames(ref, ARCHIVE));

  let here: string[];
  try {
    here = (await readdir(path.join(workspaceRoot, ARCHIVE), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    // No archive in this checkout at all: nothing was archived.
    return [];
  }

  const found: ArchivedChangeDebts[] = [];
  for (const archiveName of here.filter((name) => !onBase.has(name)).sort()) {
    let content = "";
    try {
      content = await readFile(path.join(workspaceRoot, ARCHIVE, archiveName, "tasks.md"), "utf8");
    } catch {
      // A change archived without a task list owes nothing it could list.
    }
    found.push({ archiveName, debts: describeTaskDebts(parseTaskChecklist(content)) });
  }
  return found;
}
