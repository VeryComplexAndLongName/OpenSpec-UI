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
      // An empty directory counts: nothing in it can be somebody's work,
      // and what keeps a person's fresh `mkdir` safe is the archive check
      // below, not the file count. Requiring at least one file refused the
      // case the sweep exists for (what-is-finished-is-tidied-away).
      onlyProductFiles: files.every((file) => (PRODUCT_WRITTEN_FILES as readonly string[]).includes(file)),
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

/** A directory under the worktree root that git no longer lists as a
 * working directory. Empty ones are this product's own leavings: removing
 * a working directory leaves the shell behind where a link was inside it,
 * and git stops listing it, so nothing else can see what the product
 * itself left (what-is-finished-is-tidied-away). */
export interface WorktreeShell {
  name: string;
  path: string;
  /** Whether it holds no file at any depth. Only an empty one is cleared;
   * anything else is somebody's. */
  empty: boolean;
}

/** Whether a directory holds no file at any depth. A directory of empty
 * directories is still empty: what matters is whether anything was
 * written, not how deep the tree of nothing goes. */
export async function holdsNoFile(directory: string): Promise<boolean> {
  let entries: Array<{ name: string; isDirectory: boolean }>;
  try {
    entries = (await readdir(directory, { withFileTypes: true }))
      .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
  } catch {
    // Unreadable is not empty: a directory nobody can look into is one
    // nothing here removes.
    return false;
  }
  for (const entry of entries) {
    if (!entry.isDirectory) return false;
    if (!await holdsNoFile(path.join(directory, entry.name))) return false;
  }
  return true;
}

/** Every directory under the worktree root that git does not list as a
 * working directory, with whether it holds anything.
 *
 * `known` is what `git worktree list` reports, as absolute paths; the
 * coordination directories beside them (`.agent-status`, `.agent-roster`,
 * `.agent-messages`) are never shells and are left out. */
export async function readWorktreeShells(
  worktreeRoot: string,
  known: readonly string[],
): Promise<WorktreeShell[]> {
  const root = path.resolve(worktreeRoot);
  const listed = new Set(known.map((one) => pathKeyOf(one)));
  let names: string[];
  try {
    names = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }

  const shells: WorktreeShell[] = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const full = path.join(root, name);
    if (listed.has(pathKeyOf(full))) continue;
    shells.push({ name, path: full, empty: await holdsNoFile(full) });
  }
  return shells;
}

/** Windows says the same path in more than one case; a comparison that
 * did not fold it would take a listed directory for a shell. */
function pathKeyOf(one: string): string {
  return path.resolve(one).toLowerCase();
}

export interface ShellSweep {
  removed: WorktreeShell[];
  /** Held back because something is in them. */
  kept: WorktreeShell[];
  failures: LeftoverRemovalFailure[];
}

/** Removes the empty shells and reports the rest.
 *
 * Only the empty ones: a shell is empty by definition, and a directory
 * with a file in it is somebody's, whatever git thinks of it. */
export async function clearWorktreeShells(
  worktreeRoot: string,
  known: readonly string[],
): Promise<ShellSweep> {
  const sweep: ShellSweep = { removed: [], kept: [], failures: [] };
  for (const shell of await readWorktreeShells(worktreeRoot, known)) {
    if (!shell.empty) {
      sweep.kept.push(shell);
      continue;
    }
    try {
      await rm(shell.path, { recursive: true, force: true });
      sweep.removed.push(shell);
    } catch (error) {
      sweep.failures.push({
        name: shell.name,
        path: shell.path,
        reason: await withHolders(shell.path, error),
      });
    }
  }
  return sweep;
}

/** One process that mentions a path on its command line. */
export interface PathHolder {
  pid: number;
  name: string;
  commandLine: string;
}

/** The processes whose command line mentions this path.
 *
 * Best effort, and said so wherever it is used: a process whose working
 * directory is inside but whose command line does not name it is not
 * found this way. It is how the three directories that prompted this were
 * found - each was a server started with its path as an argument
 * (what-is-finished-is-tidied-away).
 *
 * Never throws, and answers an empty list where the process list cannot
 * be read. */
export async function whoMightHold(
  directory: string,
  options: { run?: (command: string, args: string[]) => Promise<string> } = {},
): Promise<PathHolder[]> {
  const wanted = path.resolve(directory).toLowerCase();
  const run = options.run ?? defaultProcessList;
  let output: string;
  try {
    output = process.platform === "win32"
      ? await run("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process | ForEach-Object { \"$($_.ProcessId)|$($_.Name)|$($_.CommandLine)\" }",
      ])
      : await run("ps", ["-eo", "pid=,comm=,args="]);
  } catch {
    return [];
  }

  const holders: PathHolder[] = [];
  for (const line of output.split(/\r?\n/u)) {
    const text = line.trim();
    if (text.length === 0) continue;
    const parts = process.platform === "win32" ? text.split("|") : text.split(/\s+/u);
    const pid = Number.parseInt(parts[0] ?? "", 10);
    if (!Number.isFinite(pid)) continue;
    const commandLine = process.platform === "win32"
      ? (parts.slice(2).join("|") ?? "")
      : parts.slice(2).join(" ");
    const name = parts[1] ?? "";
    // Both spellings, since a command line carries whichever separator
    // the caller typed.
    const haystack = commandLine.toLowerCase().replace(/\//gu, "\\");
    if (!haystack.includes(wanted.replace(/\//gu, "\\"))) continue;
    holders.push({ pid, name, commandLine: commandLine.trim() });
  }
  return holders;
}

async function defaultProcessList(command: string, args: string[]): Promise<string> {
  const { execFile } = await import("node:child_process");
  return new Promise<string>((resolve, reject) => {
    execFile(command, args, { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

/** The reason a removal failed, with what is holding the directory where
 * anything can be found. */
export async function withHolders(directory: string, error: unknown): Promise<string> {
  const said = error instanceof Error ? error.message : String(error);
  const holders = await whoMightHold(directory);
  if (holders.length === 0) {
    return `${said}. No process names this directory on its command line; one that holds it without naming it is not found this way.`;
  }
  const named = holders.map((holder) => `${holder.name} (${holder.pid})`).join(", ");
  return `${said}. Held by ${named}, by their command lines.`;
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
    // Who, not just what: "access denied" is not something a person can
    // act on (what-is-finished-is-tidied-away).
    return { ok: false, path: directory, reason: await withHolders(directory, error) };
  }
}
