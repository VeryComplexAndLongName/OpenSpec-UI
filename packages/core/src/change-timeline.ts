// Best-effort, git-derived timestamps for a change and its tasks (see
// openspec/changes/add-change-timeline-data-layer/design.md). Every date
// degrades to `null`/`undefined` on any git failure — never throws — since
// this data is a nice-to-have visualization aid, not something the rest of
// a change read should ever depend on succeeding.

import { readFile } from "node:fs/promises";
import simpleGit from "simple-git";
import { buildChangeDates, type ChangeDates } from "./change-dates.js";
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
}

const BLAME_HEADER_RE = /^([0-9a-f]{40}) \d+ (\d+)(?: \d+)?$/;
const AUTHOR_TIME_RE = /^author-time (\d+)$/;
const ARCHIVE_DATE_RE = /^(\d{4}-\d{2}-\d{2})-/;

/** Returns a `finalLineNumber (0-indexed) -> ISO date` map derived from
 * `git blame --line-porcelain`, or `undefined` if blame itself fails
 * (shallow clone, untracked file, not a git repository). The porcelain
 * format gives full metadata (including `author-time`) only the first
 * time a given commit appears in the output; later lines from the same
 * commit are abbreviated, so `author-time` is tracked per commit sha and
 * reused for those repeats. */
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
          dates.set(currentFinalLine - 1, new Date(authorTime * 1000).toISOString());
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
  }

  return dates;
}

/** ISO 8601 (UTC, `Z`-suffixed — same representation `blameLineDates`
 * uses, so every date on a `ChangeTimeline` sorts/compares consistently)
 * timestamp of the earliest commit that added `filePath`, or `null` if
 * undeterminable. */
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

/** The last non-empty line of a `git log` output, as an ISO timestamp.
 * `git log` prints newest first, so the oldest commit is the last line. */
function oldestDateIn(output: string): string | null {
  const lines = output.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  const oldest = lines[lines.length - 1];
  return oldest ? new Date(oldest).toISOString() : null;
}

/** ISO 8601 timestamp of the commit that added `filePath` *at that
 * path*, or `null` if undeterminable.
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

/** When each archived change appeared under `archive/`, from one git
 * call for the whole directory.
 *
 * Measured on this repository 2026-09-09: asking per change costs about
 * 450ms each — 80 seconds across 178 archived changes — and this one
 * call answers all of them in 0.5s. A dating pass that makes the
 * timeline unusable is not worth its charts. See
 * change-dates-from-evidence. */
export async function readArchiveCommitDates(cwd: string): Promise<Map<string, string>> {
  const dates = new Map<string, string>();
  try {
    const output = await simpleGit(cwd).raw([
      "log",
      "--diff-filter=A",
      "--name-only",
      "--format=C%aI",
      "--",
      ARCHIVE_LOG_PATH,
    ]);
    let current: string | undefined;
    for (const rawLine of output.split("\n")) {
      const line = rawLine.trim();
      if (line.length === 0) continue;
      if (line.startsWith("C")) {
        current = line.slice(1);
        continue;
      }
      const name = archivedChangeNameFrom(line);
      // git prints newest first, so a later line for the same change is
      // an older commit: overwrite, and the oldest add wins.
      if (name && current) dates.set(name, new Date(current).toISOString());
    }
  } catch {
    // No git, a shallow clone, no archive yet. Every date falls back on
    // its own, and each says which source answered.
  }
  return dates;
}

const ARCHIVE_LOG_PATH = "openspec/changes/archive";

function archivedChangeNameFrom(filePath: string): string | undefined {
  const parts = filePath.split("/");
  const index = parts.indexOf("archive");
  return index === -1 ? undefined : parts[index + 1];
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
  const tasks: ChangeTimelineTask[] = taskItems.map((task) => ({
    ...task,
    date: task.done ? blameDates?.get(task.lineNumber) ?? null : null,
    lastTouchedDate: blameDates?.get(task.lineNumber) ?? null,
  }));

  const dates = buildChangeDates({
    changeName,
    archived,
    proposalAddedDate: createdDate,
    archiveCommitDate,
    // The ticked tasks only. Every blame date reported the proposal
    // date under another name — the task list arrives in the same commit
    // as the proposal — and left the audit log unreachable. See
    // work-dates-are-evidence-of-work.
    taskDoneDates: tasks.map((task) => task.date).filter((date): date is string => date !== null),
    ...(options?.auditTimestamps ? { auditTimestamps: options.auditTimestamps } : {}),
  });

  return {
    changeName,
    archived,
    dates,
    createdDate,
    // The same date `dates.archived` carries, as the date-only string
    // this field has always been — the sprint report prints it verbatim.
    // Its value now comes from the archiving commit where there is one,
    // and from the folder name only where there is not.
    archivedDate: dates.archived.date?.slice(0, 10) ?? null,
    proposal,
    design,
    specs,
    tasks,
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

export async function getChangeTimelines(
  workspaceRoot: string,
  entries: ChangeTimelineRequestEntry[],
): Promise<ChangeTimeline[]> {
  // One call for the whole archive rather than one per change: measured
  // 2026-09-09 at 0.5s against 80 seconds. Skipped entirely when nothing
  // in the list is archived.
  const archiveCommitDates = entries.some((entry) => entry.archived)
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
        ...(archiveCommitDates ? { archiveCommitDates } : {}),
      })),
    ));
  }
  return timelines;
}

const TIMELINE_BATCH = 8;
