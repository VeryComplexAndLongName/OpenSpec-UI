// What this repository has archived, and when
// (the-board-remembers-what-was-archived).
//
// `openspec archive` renames a change's directory to
// `openspec/changes/archive/<YYYY-MM-DD>-<id>`, so the date it was
// archived is in the name. Nothing else is read: no commit, no blame, no
// forge - one listing of one tree answers the whole question.
//
// Read from the default branch on the server rather than from a disk. The
// archive is what the repository agreed on, and every machine that has
// fetched sees the same one; a working directory's own copy is as stale as
// that directory, and a worktree on its own branch may lack the newest
// archives entirely. Two people looking at "the" archive and seeing
// different things, silently, is the failure this avoids.

export const ARCHIVE = "openspec/changes/archive";

/** `openspec archive` renames `<id>` to `<YYYY-MM-DD>-<id>`. */
const ARCHIVED_NAME = /^(\d{4}-\d{2}-\d{2})-(.+)$/u;

export interface ArchivedChange {
  /** The change's own name, without the date. */
  changeName: string;
  /** The directory's name, date and all, which is what the archive holds. */
  archivedAs: string;
  /** The day it was archived, `YYYY-MM-DD`, from that name. */
  archivedOn: string;
}

/** The archived changes a listing of directory names holds, newest first.
 * A name without a date is not one of ours and is left out rather than
 * dated by a guess. */
export function readArchivedNames(names: readonly string[]): ArchivedChange[] {
  return names
    .flatMap((name) => {
      const read = ARCHIVED_NAME.exec(name);
      return read === null ? [] : [{ changeName: read[2] as string, archivedAs: name, archivedOn: read[1] as string }];
    })
    .sort((left, right) => (left.archivedAs < right.archivedAs ? 1 : left.archivedAs > right.archivedAs ? -1 : 0));
}

/** How long an archived change stays on the board. A week: the last
 * column is there to say what closed lately, and this repository's own
 * archive is 325 changes - all of them would be a list, not a board. */
export const ARCHIVE_SHOWN_FOR_DAYS = 7;

/** At most this many, however busy the week was.
 *
 * Measured on this repository on 2026-09-23: a week of it is 75 archived
 * changes, and 75 cards in one column is the wall the window was meant to
 * prevent. A window alone follows the pace of the work; a count holds
 * whatever the pace, and everything not drawn is counted underneath. */
export const ARCHIVE_SHOWN_AT_MOST = 10;

export interface ArchiveReading {
  /** Archived within the window, newest first, at most the cap: what the
   * board draws. */
  recent: ArchivedChange[];
  /** How many more the archive holds: older than the window, or past the
   * cap. */
  older: number;
  /** Where this was read: the server's default branch, or this working
   * directory, where the branch could not be read. */
  from: "default-branch" | "working-directory";
}

/** Splits an archive into what a board draws and what it only counts. */
export function archivedRecently(
  all: readonly ArchivedChange[],
  now: Date,
  options: { days?: number; most?: number } = {},
): { recent: ArchivedChange[]; older: number } {
  const days = options.days ?? ARCHIVE_SHOWN_FOR_DAYS;
  // `days` calendar days ending today, so seven days means today and the
  // six before it. Compared as days, since a day is all the name carries:
  // a change archived this morning and one archived at midnight are the
  // same day to it.
  const earliest = new Date(now.getTime() - (days - 1) * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const recent = all
    .filter((one) => one.archivedOn >= earliest)
    .slice(0, options.most ?? ARCHIVE_SHOWN_AT_MOST);
  return { recent, older: all.length - recent.length };
}

/** What a surface says under a board whose Archived column draws only the
 * recent ones. Nothing where the archive holds no more than those: a line
 * saying "and 0 more" is noise. */
export function describeOlderArchive(reading: ArchiveReading | undefined): string | undefined {
  if (reading === undefined || reading.older === 0) return undefined;
  const where = reading.from === "default-branch" ? "" : ", as this working directory has it";
  return `${reading.older} more in the archive${where}`;
}
