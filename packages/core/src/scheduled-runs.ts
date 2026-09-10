// A run asked for at a time rather than now.
//
// `one-way-in-to-run` left this open in as many words: the dialog is
// where "now" and "at a time" belong, but the timer is its own change
// "with its own argument about what happens when the process is not
// running". That argument is the design, and the answer is that a run
// whose time passed while nothing was open starts at the next open and
// says how late it is — a schedule that quietly does not happen is worse
// than no schedule.
//
// Everything here is pure. Whether an entry is due is a comparison
// against a clock the caller passes, made where it is read: a stored
// `due` flag would be a second source of truth, wrong from the moment it
// becomes true until something updates it.
//
// See a-run-can-be-scheduled.

import { isValidChangeName } from "./change-name.js";
import { RUN_PATH_IDS, type RunPathId } from "./run-plan.js";

export interface ScheduledRun {
  changeName: string;
  /** Which path the run takes — the same choice the dialog offers now. */
  path: RunPathId;
  /** ISO 8601. When it should start. */
  startAt: string;
  /** ISO 8601. When someone asked for it, which is what "how late" is
   * measured against for a reader trying to remember what they set. */
  requestedAt: string;
}

export interface DueRun {
  entry: ScheduledRun;
  /** How far past its time this is, in milliseconds. Zero when it starts
   * on time; large when the application was closed. Carried rather than
   * rounded, so a surface decides how to say it. */
  lateByMs: number;
}

/** Why an entry will never run.
 *
 * `archived` is not `deleted`, and saying only "no longer exists" for
 * both is what let an archived change be promoted to a start: the prefix
 * match treated it as alive, both hosts then removed the entry and
 * looked the change up under a name no directory had. A chain does not
 * run against an archived change — its work is done by definition — so
 * the distinction is the behaviour, not just the wording.
 * See a-schedule-keeps-its-promise. */
export type ScheduleDropReason = "deleted" | "archived" | "unreadable-time";

export interface DroppedRun {
  entry: ScheduledRun;
  reason: ScheduleDropReason;
}

export interface ScheduleReading {
  /** The one to start now: the oldest of those due. A second mutating
   * run is refused by the workspace lease, so starting them all would
   * produce a refusal that looks like a fault. */
  start?: DueRun;
  /** Due, but not started this time. Reported so "waiting" is visible
   * rather than inferred from nothing happening. */
  waiting: DueRun[];
  /** Not due yet. */
  pending: ScheduledRun[];
  /** Entries that can never run, each with the reason. Reported, not
   * silently removed: a schedule that quietly does not happen is the
   * shape this feature exists to remove. */
  dropped: DroppedRun[];
}

export interface KnownChangeNames {
  active: readonly string[];
  archived: readonly string[];
}

/** Where a scheduled change is now.
 *
 * An archived change keeps its `YYYY-MM-DD-` prefix, so a schedule made
 * before archiving still matches it — as the archived one, never as a
 * live one. */
function locateChange(changeName: string, known: KnownChangeNames): "active" | "archived" | "gone" {
  if (known.active.includes(changeName)) return "active";
  const archived = known.archived.some(
    (name) => name === changeName || name.replace(/^\d{4}-\d{2}-\d{2}-/u, "") === changeName,
  );
  return archived ? "archived" : "gone";
}

/** Sorts the schedule into what to do with it now.
 *
 * `now` is passed rather than read, so the same reading can be asserted
 * against a fixed clock. */
export function readSchedule(
  entries: readonly ScheduledRun[],
  known: KnownChangeNames,
  now: Date,
): ScheduleReading {
  const dropped: DroppedRun[] = [];
  const pending: ScheduledRun[] = [];
  const due: DueRun[] = [];

  for (const entry of entries) {
    const where = locateChange(entry.changeName, known);
    if (where !== "active") {
      dropped.push({ entry, reason: where === "archived" ? "archived" : "deleted" });
      continue;
    }
    const startAt = new Date(entry.startAt).getTime();
    if (Number.isNaN(startAt)) {
      // A time nothing can be compared against cannot come due. Dropped
      // rather than kept as a permanent "pending" nobody can act on.
      dropped.push({ entry, reason: "unreadable-time" });
      continue;
    }
    const lateByMs = now.getTime() - startAt;
    if (lateByMs >= 0) due.push({ entry, lateByMs });
    else pending.push(entry);
  }

  due.sort((left, right) => right.lateByMs - left.lateByMs);
  const [start, ...waiting] = due;
  return { ...(start ? { start } : {}), waiting, pending, dropped };
}

/** What a drop was, in the words a person would read.
 *
 * Written once because it was written twice: the extension said "which
 * no longer exists" and the shell said "for change(s) that no longer
 * exist", both for an entry whose change had merely been archived. */
export function describeDrop(dropped: DroppedRun): string {
  const name = dropped.entry.changeName;
  switch (dropped.reason) {
    case "archived":
      return `Dropped the scheduled run for "${name}": it was archived, so its work is done.`;
    case "unreadable-time":
      return `Dropped the scheduled run for "${name}": "${dropped.entry.startAt}" is not a time this can read.`;
    default:
      return `Dropped the scheduled run for "${name}": that change no longer exists.`;
  }
}

/** Why this is starting, in the words a person would use.
 *
 * Said either way: a run that started on time says so, because "started
 * on time" and "nothing was said" have to look different. */
export function describeLateness(late: DueRun, now = new Date()): string {
  void now;
  const minutes = Math.floor(late.lateByMs / 60_000);
  const asked = new Date(late.entry.startAt).toLocaleString();
  if (minutes < 1) return `Scheduled for ${asked}, starting now.`;
  if (minutes < 60) return `Scheduled for ${asked} — starting ${minutes} minute${minutes === 1 ? "" : "s"} late.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Scheduled for ${asked} — starting ${hours} hour${hours === 1 ? "" : "s"} late.`;
  const days = Math.floor(hours / 24);
  return `Scheduled for ${asked} — starting ${days} day${days === 1 ? "" : "s"} late.`;
}

/** Refuses a time that has already passed, where it is entered.
 *
 * Accepting one and firing it immediately would answer a different
 * question than the one asked, and the person would not learn they had
 * mistyped the hour until a run was already going. */
export function checkScheduleTime(startAt: string, now: Date): string | undefined {
  const at = new Date(startAt).getTime();
  if (Number.isNaN(at)) return "That is not a time this can read.";
  if (at <= now.getTime()) return "That time has already passed. Pick a later one, or start the run now.";
  return undefined;
}

/** What is wrong with a would-be schedule entry, naming the field, or
 * `undefined` when nothing is.
 *
 * One validator for the reader and for the route that writes. Until
 * this existed, `/api/scheduled-runs` stored whatever `add` carried and
 * `readScheduledRuns` filtered it out again on the way back: the
 * response said the entry was there and the next read said it was not.
 * A record accepted on the way in has to be one the reader will hand
 * back. See a-name-is-checked-before-it-is-used.
 *
 * The field is named because a 400 that says only "invalid" leaves the
 * sender to guess which of four fields it was. */
export function describeScheduledRunProblem(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return "a scheduled run must be an object";
  const entry = value as Record<string, unknown>;

  if (typeof entry.changeName !== "string" || entry.changeName.length === 0) {
    return "changeName must be a non-empty string";
  }
  // The same rule that guards every path built from a change name: an
  // entry is stored and later started, and a name that cannot be a
  // directory cannot be a run.
  if (!isValidChangeName(entry.changeName)) {
    return `changeName "${entry.changeName}" is not a valid change name`;
  }
  if (typeof entry.path !== "string" || !RUN_PATH_IDS.includes(entry.path as RunPathId)) {
    return `path must be one of: ${RUN_PATH_IDS.join(", ")}`;
  }
  for (const field of ["startAt", "requestedAt"] as const) {
    const at = entry[field];
    if (typeof at !== "string" || at.length === 0) return `${field} must be a non-empty ISO 8601 string`;
    // A time nothing can compare against can never come due, so an
    // entry carrying one is a schedule that silently never happens.
    if (Number.isNaN(new Date(at).getTime())) return `${field} "${at}" is not a time this can read`;
  }
  return undefined;
}

/** Whether a value is a schedule entry this can act on — the reader's
 * own rule, stated once. */
export function isScheduledRun(value: unknown): value is ScheduledRun {
  return describeScheduledRunProblem(value) === undefined;
}

/** The schedule with one entry removed — what to write back after it
 * starts. Compared by change and time together: the same change may be
 * scheduled twice, and starting one must not cancel the other. */
export function withoutEntry(entries: readonly ScheduledRun[], entry: ScheduledRun): ScheduledRun[] {
  return entries.filter((candidate) =>
    !(candidate.changeName === entry.changeName && candidate.startAt === entry.startAt));
}

/** Everything a host needs to act on a pass over the schedule, and
 * nothing it has to decide.
 *
 * The read-drop-write-pick-remove loop was written twice — once in the
 * extension's watcher, once in the shell's `fireDueRuns` — down to the
 * identical "still waiting" sentence, and the two had already diverged
 * in how they wrote back and in what they did with an archived change.
 * See a-schedule-keeps-its-promise. */
export interface ScheduleFiring {
  /** What can never run, with the reason each was dropped. */
  dropped: DroppedRun[];
  /** One sentence per drop, in the order they were dropped. */
  dropNotes: string[];
  /** What to write back once the drops are applied and before the run
   * has been opened — the starting entry is still in this list, because
   * an entry is consumed only once its run has been opened. */
  afterDrops: ScheduledRun[];
  /** What to write back once the run has been opened. */
  remaining: ScheduledRun[];
  /** The one to start now, absent when nothing is due. */
  start?: DueRun;
  /** Why it is starting and how late, plus what is still waiting behind
   * it. Absent when nothing is due, so a host never prints an empty
   * explanation. */
  startNote?: string;
  /** Due behind the one that starts. One at a time: a second mutating
   * run is refused by the workspace lease. */
  waitingCount: number;
}

/** Decides a whole pass over the schedule: what to drop, what to start,
 * what to say and what to write back.
 *
 * Every sentence is built here rather than in a host, so the two hosts
 * cannot describe the same schedule differently. A host performs the
 * effects it is handed — write the file, open the run, print the lines —
 * and decides nothing about the schedule itself. */
export function planScheduleFiring(
  entries: readonly ScheduledRun[],
  known: KnownChangeNames,
  now: Date,
): ScheduleFiring {
  const reading = readSchedule(entries, known, now);

  let afterDrops = [...entries];
  for (const drop of reading.dropped) afterDrops = withoutEntry(afterDrops, drop.entry);

  const start = reading.start;
  const remaining = start ? withoutEntry(afterDrops, start.entry) : afterDrops;
  const waitingCount = reading.waiting.length;
  const waiting = waitingCount === 0 ? "" : ` ${waitingCount} more scheduled run(s) are still waiting.`;

  return {
    dropped: reading.dropped,
    dropNotes: reading.dropped.map(describeDrop),
    afterDrops,
    remaining,
    ...(start ? { start, startNote: `${describeLateness(start, now)}${waiting}` } : {}),
    waitingCount,
  };
}

/** What to say when the path an entry was scheduled on is not one this
 * host offers for that change any more — the configuration changed
 * between the schedule and the hour.
 *
 * The dialog then opens for a choice, which is the one case where a
 * scheduled run still asks. Saying why is the difference between that
 * and the dialog that used to open every time. */
export function describePathNoLongerOffered(path: RunPathId): string {
  return `The configured paths changed, so "${path}" is not offered for this change any more — choose one.`;
}
