// Best-effort, git-derived timestamps for a change and its tasks (see
// openspec/changes/add-change-timeline-data-layer/design.md). Every date
// degrades to `null`/`undefined` on any git failure — never throws — since
// this data is a nice-to-have visualization aid, not something the rest of
// a change read should ever depend on succeeding.

import { readFile } from "node:fs/promises";
import simpleGit, { type SimpleGit } from "simple-git";
import {
  buildChangeDates,
  normalizedInstant,
  withoutArchivePrefix,
  type ChangeDates,
} from "./change-dates.js";
import { readTaskChecklist, type TaskChecklistItem } from "./task-checklist.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";

export interface ChangeTimelineTask extends TaskChecklistItem {
  /** ISO 8601 date the task was last checked/unchecked, per git blame on
   * its tasks.md line — `null` when undeterminable (never checked, or
   * blame data unavailable). Only ever set for a checked (`done`) task —
   * see the comment in `getChangeTimeline` for why. */
  date: string | null;
  /** ISO 8601 date this task's line was last touched, per git blame —
   * set regardless of `done`, unlike `date`. Used to flag a still-pending
   * task as stale (see `stale-tasks.ts`), not to imply completion. `null`
   * when undeterminable. */
  lastTouchedDate: string | null;
}

export interface ChangeTimelineSpec {
  specId: string;
  content: string;
}

export interface ChangeTimeline {
  changeName: string;
  archived: boolean;
  /** When this change was proposed, first and last worked on, and
   * archived — each with where it was read from. The two fields below
   * are the same two dates without their sources, kept for the surfaces
   * that already render them. See change-dates-from-evidence. */
  dates: ChangeDates;
  /** ISO 8601, best-effort (earliest commit that added proposal.md) — `null`
   * when undeterminable (shallow clone, proposal.md never committed). */
  createdDate: string | null;
  /** ISO 8601 date, parsed from the `YYYY-MM-DD-<name>` archive folder
   * name — `null` for an active (non-archived) change. */
  archivedDate: string | null;
  proposal: string;
  design: string;
  specs: ChangeTimelineSpec[];
  tasks: ChangeTimelineTask[];
  /** How many lines of the one-call archive read could not be
   * understood, on a timeline produced by `getChangeTimelines`.
   *
   * A property of the batch read rather than of this one change, so
   * every timeline in the batch carries the same number — the point is
   * that a reader of any of them can see the read fell short. Absent
   * when nothing fell short, and on a timeline read one change at a
   * time. See a-date-is-one-day-in-every-source. */
  archiveDatesUnreadableLines?: number;
}

const BLAME_HEADER_RE = /^([0-9a-f]{40}) \d+ (\d+)(?: \d+)?$/;
const AUTHOR_TIME_RE = /^author-time (\d+)$/;
const AUTHOR_TZ_RE = /^author-tz ([+-]\d{4})$/;
const TZ_OFFSET_RE = /^[+-]\d{4}$/;
const ARCHIVE_DATE_RE = /^(\d{4}-\d{2}-\d{2})-/;

/** An author-time and its author-tz, as one ISO 8601 string carrying the
 * offset git recorded — `2026-08-27T02:30:00+03:00`, not the same
 * instant spelled in UTC.
 *
 * The offset is the whole point: it is what says which day the person
 * who wrote the line would call it. An unreadable or absent tz falls
 * back to UTC, which is what this always was. */
function recordedIso(authorTime: number, tz: string | undefined): string {
  const offset = tz !== undefined && TZ_OFFSET_RE.test(tz) ? tz : undefined;
  if (offset === undefined) return new Date(authorTime * 1000).toISOString();
  const sign = offset.startsWith("-") ? -1 : 1;
  const minutes = sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(3, 5)));
  // Shifting the instant by the offset and then printing it as UTC gives
  // the wall clock that offset was on; the offset is appended rather
  // than the `Z` that would then be a lie.
  const wallClock = new Date((authorTime + minutes * 60) * 1000).toISOString().slice(0, 19);
  return `${wallClock}${offset.slice(0, 3)}:${offset.slice(3, 5)}`;
}

/** Returns a `finalLineNumber (0-indexed) -> ISO date` map derived from
 * `git blame --line-porcelain`, or `undefined` if blame itself fails
 * (shallow clone, untracked file, not a git repository). The porcelain
 * format gives full metadata (including `author-time`) only the first
 * time a given commit appears in the output; later lines from the same
 * commit are abbreviated, so `author-time` is tracked per commit sha and
 * reused for those repeats.
 *
 * The dates carry the offset the commit recorded rather than being
 * normalised here, so a caller can read the day the author would name.
 * `getChangeTimeline` normalises them for the fields that publish a UTC
 * string. See a-date-is-one-day-in-every-source. */
export async function blameLineDates(
  cwd: string,
  filePath: string,
): Promise<Map<number, string> | undefined> {
  let output: string;
  try {
    output = await simpleGit(cwd).raw(["blame", "--line-porcelain", "--", filePath]);
  } catch {
    return undefined;
  }

  const dates = new Map<number, string>();
  const authorTimeBySha = new Map<string, number>();
  const authorTzBySha = new Map<string, string>();
  let currentSha: string | undefined;
  let currentFinalLine: number | undefined;

  for (const line of output.split("\n")) {
    const header = line.match(BLAME_HEADER_RE);
    if (header) {
      currentSha = header[1];
      currentFinalLine = Number(header[2]);
      continue;
    }
    if (line.startsWith("\t")) {
      if (currentSha !== undefined && currentFinalLine !== undefined) {
        const authorTime = authorTimeBySha.get(currentSha);
        if (authorTime !== undefined) {
          dates.set(currentFinalLine - 1, recordedIso(authorTime, authorTzBySha.get(currentSha)));
        }
      }
      currentSha = undefined;
      currentFinalLine = undefined;
      continue;
    }
    const authorTimeMatch = line.match(AUTHOR_TIME_RE);
    if (authorTimeMatch && currentSha !== undefined) {
      authorTimeBySha.set(currentSha, Number(authorTimeMatch[1]));
    }
    const authorTzMatch = line.match(AUTHOR_TZ_RE);
    if (authorTzMatch && currentSha !== undefined) {
      authorTzBySha.set(currentSha, authorTzMatch[1] as string);
    }
  }

  return dates;
}

/** ISO 8601 timestamp of the earliest commit that added `filePath`, or
 * `null` if undeterminable.
 *
 * As git printed it (`%aI`, offset and all) rather than normalised to
 * UTC: the offset is what says which day the commit was made on, and
 * normalising here is exactly what moved an archive committed at 02:30
 * in Moscow to the previous day. Callers that publish a UTC string
 * normalise with `normalizedInstant`. See
 * a-date-is-one-day-in-every-source. */
export async function getFileCreatedDate(cwd: string, filePath: string): Promise<string | null> {
  try {
    // No `--reverse`: git prints nothing at all when it is combined with
    // `--follow`, which made this return `null` for every file that had
    // ever been renamed — that is, for every archived change, silently,
    // as "undeterminable". Verified against git 2.54.0 on 2026-09-09.
    // The oldest commit is the last line instead. See
    // change-dates-from-evidence.
    const output = await simpleGit(cwd).raw([
      "log",
      "--follow",
      "--diff-filter=A",
      "--format=%aI",
      "--",
      filePath,
    ]);
    return oldestDateIn(output);
  } catch {
    return null;
  }
}

/** The last non-empty line of a `git log` output, as git printed it.
 * `git log` prints newest first, so the oldest commit is the last line. */
function oldestDateIn(output: string): string | null {
  const lines = output.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  return lines[lines.length - 1] ?? null;
}

/** ISO 8601 timestamp — as git printed it, offset included, for the
 * reason above — of the commit that added `filePath` *at that path*, or
 * `null` if undeterminable.
 *
 * Deliberately without `--follow`, which is what makes it the archiving
 * date: the archive commit is the one that made the change appear under
 * `archive/`, and following the rename would report when the file first
 * existed anywhere — which is `getFileCreatedDate`'s job. See
 * change-dates-from-evidence. */
export async function getPathAddedDate(cwd: string, filePath: string): Promise<string | null> {
  try {
    const output = await simpleGit(cwd).raw([
      "log",
      "--diff-filter=A",
      "--format=%aI",
      "--",
      filePath,
    ]);
    return oldestDateIn(output);
  } catch {
    return null;
  }
}

export interface ArchiveCommitDates {
  /** Archived change directory name -> the archiving commit's date, as
   * git printed it, offset included. */
  dates: Map<string, string>;
  /** Lines of git's output that were neither a date nor a path under
   * the archive.
   *
   * Reported rather than swallowed. This read used to tell a date line
   * from a path line by `line.startsWith("C")`, and `--name-only`
   * prints paths relative to the *repository* root — so a workspace in
   * a directory beginning with `C` turned every path into a date, threw
   * inside the `try`, and returned a short map. Every affected change
   * then fell through to the per-change call measured at 80 seconds,
   * with its source still correct: a regression nothing reported.
   * Normally zero. See a-date-is-one-day-in-every-source. */
  unreadableLines: number;
}

/** When each archived change appeared under `archive/`, from one git
 * call for the whole directory.
 *
 * Measured on this repository 2026-09-09: asking per change costs about
 * 450ms each — 80 seconds across 178 archived changes — and this one
 * call answers all of them in 0.5s. A dating pass that makes the
 * timeline unusable is not worth its charts. See
 * change-dates-from-evidence. */
export async function readArchiveCommitDates(cwd: string): Promise<ArchiveCommitDates> {
  const dates = new Map<string, string>();
  let unreadableLines = 0;
  try {
    const git = simpleGit(cwd);
    const archivePrefix = `${await pathPrefixInRepository(git)}${ARCHIVE_LOG_PATH}/`;
    const output = await git.raw([
      // git renders a path with anything unusual in it as a C-style
      // quoted string; a quoted path is a path this cannot match, and
      // the setting is the documented way to be given the bytes.
      "-c",
      "core.quotePath=false",
      "log",
      "--diff-filter=A",
      "--name-only",
      `--format=${DATE_LINE_MARK}%aI`,
      "--",
      ARCHIVE_LOG_PATH,
    ]);
    let current: string | undefined;
    for (const rawLine of output.split("\n")) {
      const line = rawLine.replace(/\r$/u, "");
      if (line.length === 0) continue;
      if (line.startsWith(DATE_LINE_MARK)) {
        current = line.slice(DATE_LINE_MARK.length).trim();
        continue;
      }
      const name = archivedChangeNameFrom(line, archivePrefix);
      if (name === undefined) {
        unreadableLines += 1;
        continue;
      }
      // git prints newest first, so a later line for the same change is
      // an older commit: overwrite, and the oldest add wins.
      if (current) dates.set(name, current);
    }
  } catch {
    // No git, a shallow clone, no archive yet. Every date falls back on
    // its own, and each says which source answered.
  }
  return { dates, unreadableLines };
}

const ARCHIVE_LOG_PATH = "openspec/changes/archive";

/** ASCII unit separator, in front of every date line so a date can be
 * told from a path by something a path cannot contain — git never
 * prints a raw control byte in a path, it quotes it. The previous mark
 * was the letter `C`. */
const DATE_LINE_MARK = "\x1f";

/** What git puts in front of every path it prints, for a workspace that
 * is not the repository root.
 *
 * `git rev-parse --show-prefix` is exactly that: the current directory's
 * path relative to the top level, slash-terminated, and empty at the
 * root. Read rather than computed against `--show-toplevel`, which would
 * need path arithmetic between two spellings of one directory — case,
 * short names, symlinks — to compare, and would fall back to reading
 * nothing whenever the two spellings differed. */
async function pathPrefixInRepository(git: SimpleGit): Promise<string> {
  try {
    const prefix = (await git.raw(["rev-parse", "--show-prefix"])).trim();
    if (prefix.length === 0) return "";
    return prefix.endsWith("/") ? prefix : `${prefix}/`;
  } catch {
    return "";
  }
}

/** A C-style quoted path as git writes one, unquoted. `core.quotePath=false`
 * stops the common case, and a path holding a quote or a control byte is
 * still quoted — reading it is cheaper than losing the change. */
function unquoteGitPath(filePath: string): string {
  if (!filePath.startsWith("\"") || !filePath.endsWith("\"") || filePath.length < 2) return filePath;
  return filePath
    .slice(1, -1)
    .replaceAll(/\\([\\"])/gu, "$1");
}

function archivedChangeNameFrom(filePath: string, archivePrefix: string): string | undefined {
  const unquoted = unquoteGitPath(filePath);
  if (!unquoted.startsWith(archivePrefix)) return undefined;
  const name = unquoted.slice(archivePrefix.length).split("/")[0];
  return name !== undefined && name.length > 0 ? name : undefined;
}

/** Parses the `YYYY-MM-DD-` prefix `openspec archive` adds to an archived
 * change's folder name — no git call, and reliable regardless of
 * squash-merge history. `null` for an active change. */
export function getChangeArchivedDate(changeName: string, archived: boolean): string | null {
  if (!archived) return null;
  return changeName.match(ARCHIVE_DATE_RE)?.[1] ?? null;
}

export interface CommitAuthor {
  name: string;
  email: string;
  /** ISO 8601 date of the commit this author is attributed for. */
  date: string;
}

export interface ChangeAuthorship {
  /** Author of the most recent commit touching the change's directory —
   * "who shipped it." For a squash-merge workflow (this repository's
   * own convention) this is usually the only commit anyway; for a
   * history with multiple commits, the most recent one is the most
   * representative single answer to "who did this." */
  primaryAuthor: CommitAuthor | null;
  /** Every distinct author (by email) across all commits touching the
   * directory, oldest to newest. Includes `primaryAuthor`. */
  contributors: CommitAuthor[];
}

const AUTHOR_LOG_FIELD_SEP = "\x1f";

/** Best-effort git-derived authorship for `changeDirPath` (an active or
 * archived change's directory) — `{ primaryAuthor: null, contributors: [] }`
 * when undeterminable (shallow clone, no history, not a git repository). */
export async function getChangeAuthorship(cwd: string, changeDirPath: string): Promise<ChangeAuthorship> {
  const empty: ChangeAuthorship = { primaryAuthor: null, contributors: [] };
  try {
    const output = await simpleGit(cwd).raw([
      "log",
      `--format=%an${AUTHOR_LOG_FIELD_SEP}%ae${AUTHOR_LOG_FIELD_SEP}%aI`,
      "--",
      changeDirPath,
    ]);
    const authors: CommitAuthor[] = [];
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [name, email, date] = trimmed.split(AUTHOR_LOG_FIELD_SEP);
      if (!name || !email || !date) continue;
      authors.push({ name, email, date: new Date(date).toISOString() });
    }
    if (authors.length === 0) return empty;

    // `git log`'s default order is newest-first, so the first parsed
    // commit is the most recent one touching this directory.
    const primaryAuthor = authors[0] ?? null;
    const seenEmails = new Set<string>();
    const contributors: CommitAuthor[] = [];
    for (const author of [...authors].reverse()) {
      if (seenEmails.has(author.email)) continue;
      seenEmails.add(author.email);
      contributors.push(author);
    }
    return { primaryAuthor, contributors };
  } catch {
    return empty;
  }
}

export async function getChangeTimeline(
  workspaceRoot: string,
  changeName: string,
  archived: boolean,
  options?: {
    /** Timestamps of runs recorded against this change, from a caller
     * that has the audit log open. Optional: the log is not readable
     * from every host, and this repository's begins 2026-09-02, so it is
     * a second source of when work happened rather than the first. */
    auditTimestamps?: readonly string[];
    /** When each archived change appeared under `archive/`, read once
     * for the whole directory. Passed by `getChangeTimelines`, which
     * would otherwise spend a git call per change. */
    archiveCommitDates?: ReadonlyMap<string, string>;
    /** What that one read could not understand, carried onto the
     * timeline so a fallback to the per-change call is visible rather
     * than silent. */
    archiveDatesUnreadableLines?: number;
  },
): Promise<ChangeTimeline> {
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  const change = (archived ? workspace.archivedChanges : workspace.changes).find(
    (c) => c.name === changeName,
  );

  const proposalArtifact = change?.artifacts.find((a) => a.id === "proposal");
  const designArtifact = change?.artifacts.find((a) => a.id === "design");
  const specArtifacts = change?.artifacts.filter((a) => a.kind === "delta-spec") ?? [];

  const [proposal, design, specs, taskItems, createdDate, blameDates, archiveCommitDate] = await Promise.all([
    readIfExists(proposalArtifact),
    readIfExists(designArtifact),
    Promise.all(
      specArtifacts.map(async (artifact): Promise<ChangeTimelineSpec> => ({
        specId: artifact.label,
        content: await readIfExists(artifact),
      })),
    ),
    readTaskChecklist(workspaceRoot, changeName, archived),
    proposalArtifact?.exists
      ? getFileCreatedDate(workspaceRoot, proposalArtifact.path)
      : Promise.resolve(null),
    (async () => {
      const tasksArtifact = change?.artifacts.find((a) => a.id === "tasks");
      return tasksArtifact?.exists ? blameLineDates(workspaceRoot, tasksArtifact.path) : undefined;
    })(),
    // Only for an archived change, and only one call: an active change
    // has no archiving to date, and asking anyway would spend a git call
    // per change on every timeline page.
    archived && proposalArtifact?.exists
      // Already read for the whole archive by a caller listing many
      // changes; asked per path only when this is the one change being
      // looked at.
      ? Promise.resolve(options?.archiveCommitDates?.get(changeName))
        .then((batched) => batched ?? getPathAddedDate(workspaceRoot, proposalArtifact.path))
      : Promise.resolve(null),
  ]);

  // blame reports when a line was last touched, which for a still-unchecked
  // task is just its creation/last-edit date, not a completion date — that
  // would misleadingly look like "done on this date" in the UI, so only a
  // checked task's date is ever surfaced (see design.md).
  //
  // Normalised to UTC here, and only here: these two fields are sorted
  // with `localeCompare` by the timeline view and compared against a
  // range by the sprint report, and a set of strings in mixed offsets
  // sorts by its offsets. What the day was is `dates`' business, and it
  // is handed the recorded form below.
  const tasks: ChangeTimelineTask[] = taskItems.map((task) => ({
    ...task,
    date: task.done ? normalizedInstant(blameDates?.get(task.lineNumber)) : null,
    lastTouchedDate: normalizedInstant(blameDates?.get(task.lineNumber)),
  }));

  const dates = buildChangeDates({
    changeName,
    archived,
    proposalAddedDate: createdDate,
    archiveCommitDate,
    // The ticked tasks only, as git recorded them. Every blame date
    // reported the proposal date under another name — the task list
    // arrives in the same commit as the proposal — and left the audit
    // log unreachable. See work-dates-are-evidence-of-work.
    taskDoneDates: taskItems
      .filter((task) => task.done)
      .map((task) => blameDates?.get(task.lineNumber))
      .filter((date): date is string => date !== undefined),
    ...(options?.auditTimestamps ? { auditTimestamps: options.auditTimestamps } : {}),
  });

  return {
    changeName,
    archived,
    dates,
    // The instant, normalised, for the same reason a task's is.
    createdDate: normalizedInstant(createdDate),
    // The same day `dates.archived` carries, as the date-only string
    // this field has always been — the sprint report and the timeline
    // view print it verbatim. Its value comes from the archiving commit
    // where there is one, and from the folder name only where there is
    // not; either way it is the day that record names, never the UTC
    // slice of an instant. See a-date-is-one-day-in-every-source.
    archivedDate: dates.archived.day,
    proposal,
    design,
    specs,
    tasks,
    ...(options?.archiveDatesUnreadableLines
      ? { archiveDatesUnreadableLines: options.archiveDatesUnreadableLines }
      : {}),
  };
}

async function readIfExists(artifact: { path: string; exists: boolean } | undefined): Promise<string> {
  if (!artifact?.exists) return "";
  return readFile(artifact.path, "utf8");
}

export interface ChangeTimelineRequestEntry {
  changeName: string;
  archived: boolean;
}

export interface ChangeTimelinesOptions {
  /** The timestamps of the runs recorded against each change, keyed by
   * the change's directory name, from a host that has read the audit
   * log once for the whole request.
   *
   * The single-change function has taken audit timestamps since
   * `change-dates-from-evidence`, and this one had no way to pass them
   * — which made it the one production entry from either host that
   * could not, so `firstWorked.source === "audit-log"` existed in tests
   * and in no workspace. Both hosts pass them now; a workspace with no
   * audit log passes nothing and the source stays git-blame, which is
   * what happened before. See a-date-is-one-day-in-every-source. */
  auditTimestampsByChange?: ReadonlyMap<string, readonly string[]>;
}

export async function getChangeTimelines(
  workspaceRoot: string,
  entries: ChangeTimelineRequestEntry[],
  options?: ChangeTimelinesOptions,
): Promise<ChangeTimeline[]> {
  // One call for the whole archive rather than one per change: measured
  // 2026-09-09 at 0.5s against 80 seconds. Skipped entirely when nothing
  // in the list is archived.
  const archive = entries.some((entry) => entry.archived)
    ? await readArchiveCommitDates(workspaceRoot)
    : undefined;
  // In batches rather than all at once. Each timeline opens files and
  // spawns git, and `Promise.all` over every change did both 185 times
  // at once on this repository — `EMFILE: too many open files`, measured
  // 2026-09-09. The limit is a judgement: high enough that the git calls
  // still overlap, low enough that the handles do not run out.
  const timelines: ChangeTimeline[] = [];
  for (let index = 0; index < entries.length; index += TIMELINE_BATCH) {
    const batch = entries.slice(index, index + TIMELINE_BATCH);
    timelines.push(...await Promise.all(
      batch.map((entry) => getChangeTimeline(workspaceRoot, entry.changeName, entry.archived, {
        ...(archive ? { archiveCommitDates: archive.dates } : {}),
        ...(archive && archive.unreadableLines > 0
          ? { archiveDatesUnreadableLines: archive.unreadableLines }
          : {}),
        ...auditFor(entry, options?.auditTimestampsByChange),
      })),
    ));
  }
  return timelines;
}

/** The runs recorded against one entry, looked up by the name the log
 * would have used.
 *
 * An archived change's directory is renamed when it is archived, and
 * the audit log holds the path as it was at the time — the name without
 * the date prefix. Looking an archived change up by its archived name
 * alone would find nothing, which is the same "the source exists and
 * reaches nobody" defect one level down. */
function auditFor(
  entry: ChangeTimelineRequestEntry,
  byChange: ReadonlyMap<string, readonly string[]> | undefined,
): { auditTimestamps?: readonly string[] } {
  if (!byChange) return {};
  const timestamps = byChange.get(entry.changeName)
    ?? (entry.archived ? byChange.get(withoutArchivePrefix(entry.changeName)) : undefined);
  return timestamps && timestamps.length > 0 ? { auditTimestamps: timestamps } : {};
}

const TIMELINE_BATCH = 8;
