// When a change was proposed, worked on, and archived — and where each
// of those was read from.
//
// The source travels with the date because a chart cannot otherwise tell
// a measured date from an inferred one, and they plot identically.
// "Created 9 September" read from the commit that added `proposal.md`
// and "created 9 September" read from a directory name are different
// claims, and only one of them survives someone renaming the directory.
//
// The *day* travels with it for the same kind of reason. A commit
// records its own offset; normalising it to UTC and slicing ten
// characters off the front moves an archive made at 02:30 in Moscow to
// the previous day, while the directory that same command named says the
// 27th. Two sources then disagree about one action. The day is therefore
// read from the record as it was written, before any normalisation, and
// the instant is kept beside it — normalised — so ordering and lead
// times are unaffected. See a-date-is-one-day-in-every-source.
//
// Nothing here reads a date a person typed. That is the convention this
// exists to remove, and it fails exactly the case that prompted it: a
// change made by someone who never read the convention.
//
// Nothing here throws, by construction rather than by each caller
// remembering: every source is parsed through `readDatedFact`, and a
// string `Date` cannot read comes back absent with the source saying so.
//
// See change-dates-from-evidence.

/** Where a date was read from.
 *
 * `"none"` is a fact, not a failure: a change nobody has committed has
 * no creation date, and a chart should be able to say so rather than
 * fall back to today. `"unreadable"` is the other kind of absence —
 * there *was* something to read and it was not a date, which is a
 * defect in the record rather than a gap in it. */
export type ChangeDateSource =
  | "git-commit"
  | "git-blame"
  | "audit-log"
  | "folder-name"
  | "unreadable"
  | "none";

export interface DatedFact {
  /** The instant, normalised to UTC (`Z`-suffixed ISO 8601), or `null`
   * when there was nothing readable to take it from. Normalised because
   * this is what orders and subtracts: two instants recorded in
   * different offsets compare correctly only in one representation. */
  date: string | null;
  /** `YYYY-MM-DD` — the day where the action happened, as its own record
   * states it, and never the UTC slice of `date`. A commit made at
   * 02:30 +03:00 is that day to the person who made it and to the
   * directory the archive named. `null` whenever `date` is. */
  day: string | null;
  source: ChangeDateSource;
}

export interface ChangeDates {
  /** The earliest commit that added `proposal.md`, followed through the
   * rename `openspec archive` performs. */
  proposed: DatedFact;
  /** The earliest evidence that work happened: a task that was finished
   * or a run that was recorded. Not a line that was written — see
   * `taskDoneDates`. */
  firstWorked: DatedFact;
  /** The latest of the same. */
  lastWorked: DatedFact;
  /** The commit that put the change under `archive/`. The dated folder
   * prefix is the fallback, and says so when it is used. */
  archived: DatedFact;
}

export const NO_DATE: DatedFact = { date: null, day: null, source: "none" };

/** There was something recorded and it was not a date — a hand-moved
 * folder with a typo in its prefix, a truncated log line. Absent like
 * `NO_DATE`, and distinguishable from it: nothing to read and
 * unreadable are different facts about a record. */
export const UNREADABLE_DATE: DatedFact = { date: null, day: null, source: "unreadable" };

/** The `YYYY-MM-DD-` prefix `openspec archive` adds to an archived
 * change's folder name. Right whenever that command did the archiving,
 * and absent or wrong whenever anything else did — which is why it is
 * the fallback rather than the source.
 *
 * Deliberately permissive about what the digits mean: `2026-13-01` is
 * shaped like a date and is not one, and this has to match it so that
 * `readDatedFact` can report it as unreadable rather than leave it
 * looking like a folder with no prefix at all. */
const ARCHIVE_PREFIX = /^(\d{4}-\d{2}-\d{2})-/;

/** The day at the head of a recorded timestamp, before any parsing. */
const DAY_AS_RECORDED = /^(\d{4}-\d{2}-\d{2})/;

/** The one parse. Returns a fact whose `date` is the instant normalised
 * to UTC and whose `day` is the day the record itself names, or an
 * absent fact for anything `Date` cannot read.
 *
 * `dayAsRecorded` is for the one source that has a day and no instant:
 * a folder name is a day, and the midnight stamp built from it is a
 * representation rather than a measurement.
 *
 * Exported because the hosts read the same rule when they hand evidence
 * in, and two copies of "which ten characters are the day" is exactly
 * the drift this change exists to remove. */
export function readDatedFact(
  recorded: string | null | undefined,
  source: ChangeDateSource,
  dayAsRecorded?: string,
): DatedFact {
  if (!recorded) return NO_DATE;
  const at = new Date(recorded);
  if (Number.isNaN(at.getTime())) return UNREADABLE_DATE;
  const normalized = at.toISOString();
  return {
    date: normalized,
    day: dayAsRecorded ?? DAY_AS_RECORDED.exec(recorded)?.[1] ?? normalized.slice(0, 10),
    source,
  };
}

/** The instant a record names, normalised to UTC, or `null` when it
 * names none that `Date` can read.
 *
 * The same parse `readDatedFact` makes, for the surfaces that publish a
 * UTC string and must keep publishing one — `ChangeTimeline.createdDate`
 * and a task's date, which are sorted with `localeCompare` and would
 * sort by their offset rather than by their instant if they carried
 * one. The *day* never comes from here; that is what `DatedFact.day`
 * is. */
export function normalizedInstant(recorded: string | null | undefined): string | null {
  return readDatedFact(recorded, "none").date;
}

/** An archived change's folder name without the `YYYY-MM-DD-` prefix
 * `openspec archive` added — the name the change had while it was
 * active, and the name anything recorded against it back then used.
 *
 * The audit log is the case: a run is recorded against a change's
 * directory, and that directory is renamed when the change is archived,
 * so looking the runs up by the archived name finds none. Returns the
 * name unchanged when there is no prefix. */
export function withoutArchivePrefix(changeName: string): string {
  return changeName.replace(ARCHIVE_PREFIX, "");
}

export interface ChangeDateEvidence {
  changeName: string;
  archived: boolean;
  /** From `git log --diff-filter=A --follow` on `proposal.md`, as git
   * printed it (`%aI`, with its offset) — not normalised by the caller,
   * because the offset is what says which day it was. */
  proposalAddedDate?: string | null;
  /** From `git log --diff-filter=A` at the archive path — without
   * `--follow`, so it reports when the change appeared *there* rather
   * than when it first existed. As git printed it, for the same reason
   * as above. */
  archiveCommitDate?: string | null;
  /** The dates of the change's *ticked* tasks — a task that was
   * finished, not a line that was written.
   *
   * It was every blame date over `tasks.md` for a day, and that reported
   * the proposal date under another name: the task list is added by the
   * same commit that proposes the change, so its earliest blame date is
   * that commit. Measured across 185 changes, the span from proposed to
   * first worked was exactly zero for every one of them, and the audit
   * log could never contribute because a run always happens after the
   * file exists. See work-dates-are-evidence-of-work. */
  taskDoneDates?: Iterable<string>;
  /** Timestamps of runs recorded against this change. A second source,
   * not the first: this repository's audit log begins 2026-09-02, so it
   * says nothing about anything older.
   *
   * Reaches every host — the server route and the extension command
   * each read the log once per request and hand these down. It was
   * accepted here and passable from nowhere for a while, so the source
   * appeared in tests and in no workspace. See
   * a-date-is-one-day-in-every-source. */
  auditTimestamps?: Iterable<string>;
}

/** Assembles the four dates from whatever evidence was gathered.
 *
 * Pure, so the git and log reads stay where they can be shared — the
 * timeline already blames `tasks.md` for its task list, and re-reading it
 * per date over 50+ archived changes is the difference between a page
 * that loads and one that does not. */
export function buildChangeDates(evidence: ChangeDateEvidence): ChangeDates {
  const worked = collectWorked(evidence);

  return {
    proposed: readDatedFact(evidence.proposalAddedDate, "git-commit"),
    firstWorked: worked.first,
    lastWorked: worked.last,
    archived: archivedDate(evidence),
  };
}

function archivedDate(evidence: ChangeDateEvidence): DatedFact {
  if (!evidence.archived) return NO_DATE;
  if (evidence.archiveCommitDate) return readDatedFact(evidence.archiveCommitDate, "git-commit");
  // Only now the folder name, and it says so: a chart that cannot tell
  // this from the commit above would be treating a naming convention as
  // a measurement.
  const prefix = ARCHIVE_PREFIX.exec(evidence.changeName)?.[1];
  if (!prefix) return NO_DATE;
  // The day is the prefix itself — it is already the local day whoever
  // archived would name, and there is no offset to read. The midnight
  // stamp beside it is only so the fact carries an instant like every
  // other one.
  return readDatedFact(`${prefix}T00:00:00.000Z`, "folder-name", prefix);
}

/** The earliest and latest evidence of work, and which kind of evidence
 * each came from. Blame and the audit log are compared as one set rather
 * than preferred one over the other: whichever is earlier is when work
 * started, whoever recorded it. */
function collectWorked(evidence: ChangeDateEvidence): { first: DatedFact; last: DatedFact } {
  const candidates: DatedFact[] = [];
  let unreadable = false;
  for (const date of evidence.taskDoneDates ?? []) {
    const fact = readDatedFact(date, "git-blame");
    if (fact.date) candidates.push(fact);
    else if (fact.source === "unreadable") unreadable = true;
  }
  for (const date of evidence.auditTimestamps ?? []) {
    const fact = readDatedFact(date, "audit-log");
    if (fact.date) candidates.push(fact);
    else if (fact.source === "unreadable") unreadable = true;
  }
  // Only when nothing else was readable: one torn line among ten good
  // ticks does not make when the work happened unknown, but ten torn
  // lines and nothing else is a record that cannot be read rather than
  // work that never happened.
  if (candidates.length === 0) {
    return unreadable
      ? { first: UNREADABLE_DATE, last: UNREADABLE_DATE }
      : { first: NO_DATE, last: NO_DATE };
  }

  const sorted = [...candidates].sort((left, right) => (left.date as string).localeCompare(right.date as string));
  return { first: sorted[0] as DatedFact, last: sorted[sorted.length - 1] as DatedFact };
}
