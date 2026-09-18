// What a workspace is left holding, and what the product may clear of it
// (the-workspace-clears-what-it-left-behind).
//
// `openspec archive` moves the documents it knows about. A `harness.json`
// written by the per-change harness settings panel is not one of them, so
// the directory survives the move with that file alone in it - and every
// host then listed it beside real work as a change with no tasks. Two of
// those appeared on 2026-09-18, both holding `{}`.
//
// The rule here is the narrowest one that covers what happened: a
// directory with no documents is not a change, and it is cleared only
// where a change of that name is already archived and every file in it is
// one the product itself writes. A person who made
// `openspec/changes/my-idea/` and has not written the proposal yet keeps
// their directory, because nothing of that name is archived.

import { readdir, rm, stat, lstat, unlink, rmdir } from "node:fs/promises";
import path from "node:path";
import { createGitWrapper, type GitWrapper } from "./git.js";

/** What makes a directory a change rather than a leftover. `specs` is a
 * directory; the rest are files. */
export const CHANGE_DOCUMENTS = ["proposal.md", "design.md", "tasks.md", "specs"] as const;

/** The files this product writes into a change's directory of its own
 * accord. `.openspec.yaml` is deliberately absent: it is how a change
 * declares its schema, and a change being started by hand can hold it
 * alone, so a directory holding one is reported and never cleared. */
export const PRODUCT_WRITTEN_FILES = ["harness.json", "status.json"] as const;

/** `openspec archive` renames `<id>` to `<YYYY-MM-DD>-<id>`. */
const ARCHIVE_PREFIX = /^\d{4}-\d{2}-\d{2}-/u;

/** How often a host sweeps, beside the other intervals core settles.
 *
 * Half an hour, from judgement rather than measurement: a leftover is
 * made by archiving, which a person does a few times a day at most, and
 * the sweep reads one directory listing per change. Sooner would cost a
 * reading for nothing; a day would leave the thing this exists to remove
 * sitting in the view for a day. Both hosts import this so they cannot
 * drift apart. */
export const LEFTOVER_SWEEP_INTERVAL_MS = 30 * 60_000;

export interface WorkspaceLeftover {
  /** The directory's own name, which is the change id it was. */
  name: string;
  /** Absolute, so a host can name it and remove it. */
  path: string;
  /** What it holds, sorted, so a person can see what would go. */
  files: string[];
  /** Every file in it is one the product writes. */
  onlyProductFiles: boolean;
  /** The archived change's directory name, where one of this name is in
   * the archive. Absent means nothing of this name was ever archived,
   * which is what tells a leftover from a change somebody is about to
   * write. */
  archivedAs?: string;
}

/** Whether a directory's entries say it is a change. One document is
 * enough; a directory with none is a leftover whatever else it holds.
 * `workbench.ts` reads this rather than keeping a second copy. */
export function holdsChangeDocuments(entries: readonly string[]): boolean {
  return entries.some((entry) => (CHANGE_DOCUMENTS as readonly string[]).includes(entry));
}

async function entriesOf(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.map((entry) => entry.name).sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function directoriesUnder(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

/** Every directory under `openspec/changes/` that carries no document.
 *
 * The archive is read too, but only for its names: the check that tells a
 * leftover from somebody's start is whether a change of this name was
 * archived, and that is a lookup rather than a second walk. */
export async function readWorkspaceLeftovers(root: string): Promise<WorkspaceLeftover[]> {
  const changesRoot = path.join(root, "openspec", "changes");
  const archiveRoot = path.join(changesRoot, "archive");
  const [names, archived] = await Promise.all([
    directoriesUnder(changesRoot),
    directoriesUnder(archiveRoot),
  ]);
  const archivedByName = new Map(archived.map((name) => [name.replace(ARCHIVE_PREFIX, ""), name]));

  const leftovers: WorkspaceLeftover[] = [];
  for (const name of names) {
    if (name === "archive") continue;
    const directory = path.join(changesRoot, name);
    const files = await entriesOf(directory);
    if (holdsChangeDocuments(files)) continue;
    leftovers.push({
      name,
      path: directory,
      files,
      onlyProductFiles: files.length > 0
        && files.every((file) => (PRODUCT_WRITTEN_FILES as readonly string[]).includes(file)),
      ...(archivedByName.has(name) ? { archivedAs: archivedByName.get(name) as string } : {}),
    });
  }
  return leftovers;
}

export interface LeftoverRemovalFailure {
  name: string;
  path: string;
  reason: string;
}

export interface LeftoverSweep {
  /** Removed by this sweep, or already gone when it looked. */
  removed: WorkspaceLeftover[];
  /** Left where it is, because it holds something the product did not
   * write or because nothing of its name is archived. */
  kept: WorkspaceLeftover[];
  /** Reported rather than thrown: a sweep that cannot remove one
   * directory has still done the rest, and a host shows this beside what
   * it found. */
  failures: LeftoverRemovalFailure[];
}

/** Whether the product may clear a leftover of its own accord. */
export function isClearable(leftover: WorkspaceLeftover): boolean {
  return leftover.archivedAs !== undefined && leftover.onlyProductFiles;
}

/** Removes what this product left behind, and reports the rest.
 *
 * Idempotent: a directory already gone counts as removed, so two hosts
 * sweeping one workspace is not a race anybody has to answer. */
export async function clearWorkspaceLeftovers(root: string): Promise<LeftoverSweep> {
  const sweep: LeftoverSweep = { removed: [], kept: [], failures: [] };
  for (const leftover of await readWorkspaceLeftovers(root)) {
    if (!isClearable(leftover)) {
      sweep.kept.push(leftover);
      continue;
    }
    try {
      await rm(leftover.path, { recursive: true, force: true });
      sweep.removed.push(leftover);
    } catch (error) {
      sweep.failures.push({
        name: leftover.name,
        path: leftover.path,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return sweep;
}

export type WorkingDirectoryRemoval =
  | { ok: true; path: string; linksRemoved: number }
  | { ok: false; path: string; reason: string };

/** Deletes a link as a link, wherever one is found.
 *
 * A worktree's `node_modules` is a junction into the primary directory,
 * and its `@openspec-ui` entries are junctions into that directory's own
 * packages. A recursive delete walks through a junction and takes the
 * primary tree's packages with it - which is how this was learned. Every
 * link is unlinked first, so what is left to remove is only this
 * directory's own files. */
async function unlinkLinks(directory: string): Promise<number> {
  let removed = 0;
  let entries: Array<{ name: string; isDirectory: boolean }>;
  try {
    entries = (await readdir(directory, { withFileTypes: true }))
      .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    const link = await lstat(full).catch(() => undefined);
    if (!link) continue;
    if (link.isSymbolicLink()) {
      // A directory junction on Windows reports as a symbolic link to
      // `lstat`, and `unlink` removes the link rather than its target.
      await (link.isDirectory() ? rmdir(full).catch(() => unlink(full)) : unlink(full)).catch(() => undefined);
      removed += 1;
      continue;
    }
    if (entry.isDirectory) removed += await unlinkLinks(full);
  }
  return removed;
}

/** Removes a working directory, once somebody has pressed for it.
 *
 * Refused where the tree is not clean: a directory whose branch merged
 * can still hold uncommitted work, and there is no undo. The check runs
 * git in that directory, which is the one place this product does so
 * against a directory it does not own - and it runs only where somebody
 * has asked for the removal. */
export async function removeWorkingDirectory(
  directory: string,
  options: { git?: Pick<GitWrapper, "status"> } = {},
): Promise<WorkingDirectoryRemoval> {
  const there = await stat(directory).catch(() => undefined);
  if (!there) return { ok: true, path: directory, linksRemoved: 0 };

  const git = options.git ?? createGitWrapper({ cwd: directory });
  try {
    const status = await git.status();
    if (!status.isClean) {
      return { ok: false, path: directory, reason: "the working tree is not clean" };
    }
  } catch (error) {
    return { ok: false, path: directory, reason: error instanceof Error ? error.message : String(error) };
  }

  try {
    const linksRemoved = await unlinkLinks(directory);
    await rm(directory, { recursive: true, force: true });
    return { ok: true, path: directory, linksRemoved };
  } catch (error) {
    return { ok: false, path: directory, reason: error instanceof Error ? error.message : String(error) };
  }
}
