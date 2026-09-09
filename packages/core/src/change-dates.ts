// When a change was proposed, worked on, and archived — and where each
// of those was read from.
//
// The source travels with the date because a chart cannot otherwise tell
// a measured date from an inferred one, and they plot identically.
// "Created 9 September" read from the commit that added `proposal.md`
// and "created 9 September" read from a directory name are different
// claims, and only one of them survives someone renaming the directory.
//
// Nothing here reads a date a person typed. That is the convention this
// exists to remove, and it fails exactly the case that prompted it: a
// change made by someone who never read the convention.
//
// See change-dates-from-evidence.

/** Where a date was read from. `"none"` is a fact, not a failure: a
 * change nobody has committed has no creation date, and a chart should
 * be able to say so rather than fall back to today. */
export type ChangeDateSource =
  | "git-commit"
  | "git-blame"
  | "audit-log"
  | "folder-name"
  | "none";

export interface DatedFact {
  /** ISO 8601, or `null` when there was nothing to read it from. */
  date: string | null;
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

export const NO_DATE: DatedFact = { date: null, source: "none" };

/** The `YYYY-MM-DD-` prefix `openspec archive` adds to an archived
 * change's folder name. Right whenever that command did the archiving,
 * and absent or wrong whenever anything else did — which is why it is
 * the fallback rather than the source. */
const ARCHIVE_PREFIX = /^(\d{4}-\d{2}-\d{2})-/;

export interface ChangeDateEvidence {
  changeName: string;
  archived: boolean;
  /** From `git log --diff-filter=A --follow` on `proposal.md`. */
  proposalAddedDate?: string | null;
  /** From `git log --diff-filter=A` at the archive path — without
   * `--follow`, so it reports when the change appeared *there* rather
   * than when it first existed. */
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
   * says nothing about anything older. */
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
    proposed: evidence.proposalAddedDate
      ? { date: evidence.proposalAddedDate, source: "git-commit" }
      : NO_DATE,
    firstWorked: worked.first,
    lastWorked: worked.last,
    archived: archivedDate(evidence),
  };
}

function archivedDate(evidence: ChangeDateEvidence): DatedFact {
  if (!evidence.archived) return NO_DATE;
  if (evidence.archiveCommitDate) return { date: evidence.archiveCommitDate, source: "git-commit" };
  // Only now the folder name, and it says so: a chart that cannot tell
  // this from the commit above would be treating a naming convention as
  // a measurement.
  const prefix = ARCHIVE_PREFIX.exec(evidence.changeName)?.[1];
  return prefix ? { date: new Date(`${prefix}T00:00:00.000Z`).toISOString(), source: "folder-name" } : NO_DATE;
}

/** The earliest and latest evidence of work, and which kind of evidence
 * each came from. Blame and the audit log are compared as one set rather
 * than preferred one over the other: whichever is earlier is when work
 * started, whoever recorded it. */
function collectWorked(evidence: ChangeDateEvidence): { first: DatedFact; last: DatedFact } {
  const candidates: DatedFact[] = [];
  for (const date of evidence.taskDoneDates ?? []) {
    if (date) candidates.push({ date, source: "git-blame" });
  }
  for (const date of evidence.auditTimestamps ?? []) {
    if (date) candidates.push({ date, source: "audit-log" });
  }
  if (candidates.length === 0) return { first: NO_DATE, last: NO_DATE };

  const sorted = [...candidates].sort((left, right) => (left.date as string).localeCompare(right.date as string));
  return { first: sorted[0] as DatedFact, last: sorted[sorted.length - 1] as DatedFact };
}
