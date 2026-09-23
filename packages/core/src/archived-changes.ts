// Reading the archive off a ref or a disk. The words and the arithmetic
// are in `archived-changes-facts.ts`, which the browser can have; this
// file touches git and the filesystem (the-board-remembers-what-was-archived).

import { readdir } from "node:fs/promises";
import path from "node:path";
import { ARCHIVE, archivedRecently, readArchivedNames, type ArchiveReading } from "./archived-changes-facts.js";
import type { GitWrapper } from "./git.js";

export interface ArchiveReadOptions {
  git?: Pick<GitWrapper, "listTreeNames">;
  remote?: string;
  defaultBranch?: string;
  now?: () => Date;
  days?: number;
  most?: number;
}

/** What this repository archived, as the server's default branch has it.
 *
 * Falls back to this working directory where that branch cannot be read -
 * no remote, never fetched, a repository of one machine. Showing this
 * directory's archive is better than showing none, and the reading says
 * which it is so a surface need not guess. */
export async function readArchivedChanges(root: string, options: ArchiveReadOptions = {}): Promise<ArchiveReading> {
  const now = (options.now ?? (() => new Date()))();
  const ref = `${options.remote ?? "origin"}/${options.defaultBranch ?? "main"}`;
  const git = options.git;

  if (git !== undefined) {
    const names = await git.listTreeNames(ref, ARCHIVE).catch(() => undefined);
    if (names !== undefined) {
      return { ...archivedRecently(readArchivedNames(names), now, { ...(options.days !== undefined ? { days: options.days } : {}), ...(options.most !== undefined ? { most: options.most } : {}) }), from: "default-branch" };
    }
  }
  const onDisk = await readdir(path.join(root, ARCHIVE)).catch(() => [] as string[]);
  return { ...archivedRecently(readArchivedNames(onDisk), now, { ...(options.days !== undefined ? { days: options.days } : {}), ...(options.most !== undefined ? { most: options.most } : {}) }), from: "working-directory" };
}
