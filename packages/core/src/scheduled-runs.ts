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

import type { RunPathId } from "./run-plan.js";

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
  /** Entries naming a change that is neither active nor archived. Such a
   * change was deleted, so its schedule can never run; keeping it would
   * leave a "waiting" that never resolves. Reported, not silently
   * removed. */
  dropped: ScheduledRun[];
}

export interface KnownChangeNames {
  active: readonly string[];
  archived: readonly string[];
}

/** Whether a change still exists under either name. An archived change
 * keeps its `YYYY-MM-DD-` prefix, so a schedule made before archiving
 * still resolves. */
function stillExists(changeName: string, known: KnownChangeNames): boolean {
  if (known.active.includes(changeName)) return true;
  return known.archived.some((name) => name === changeName || name.replace(/^\d{4}-\d{2}-\d{2}-/u, "") === changeName);
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
  const dropped: ScheduledRun[] = [];
  const pending: ScheduledRun[] = [];
  const due: DueRun[] = [];

  for (const entry of entries) {
    if (!stillExists(entry.changeName, known)) {
      dropped.push(entry);
      continue;
    }
    const startAt = new Date(entry.startAt).getTime();
    if (Number.isNaN(startAt)) {
      // A time nothing can be compared against cannot come due. Dropped
      // with the deleted ones rather than kept as a permanent "pending"
      // nobody can act on.
      dropped.push(entry);
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

/** The schedule with one entry removed — what to write back after it
 * starts. Compared by change and time together: the same change may be
 * scheduled twice, and starting one must not cancel the other. */
export function withoutEntry(entries: readonly ScheduledRun[], entry: ScheduledRun): ScheduledRun[] {
  return entries.filter((candidate) =>
    !(candidate.changeName === entry.changeName && candidate.startAt === entry.startAt));
}
