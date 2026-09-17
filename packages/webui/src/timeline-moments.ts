// What the Timeline's one-change screen draws, from a `ChangeTimeline`
// (the-change-timeline-looks-like-the-mockup). Pure: the view draws what
// these return and derives nothing itself, as `summary-figures.ts` does for
// the summary.

import { isTaskStale, type ChangeDateSource, type DatedFact } from "@openspec-ui/core/browser";
import type { ChangeTimeline, ChangeTimelineTask } from "./change-timeline-client.js";

/** One point on the rail: something that happened at one instant. */
export type TimelineMoment =
  | { kind: "proposed"; at: string }
  | { kind: "tasks"; at: string; tasks: ChangeTimelineTask[] }
  /** `day`: set when the date was read from the archive folder's name,
   * which holds a day and no time. No time is shown then, and the moment is
   * placed at that day's end, so it never comes before the day's ticks (the
   * multi-change view anchors it the same way). */
  | { kind: "archived"; at: string; folder: string; day?: string };

function instant(value: string): number {
  return new Date(value).getTime();
}

/** The proposal, each instant tasks were ticked at, and the archive, oldest
 * first. Tasks share a moment only when git gives them the same instant: two
 * commits a minute apart are two moments. A fact or a task with no date is
 * not a moment. */
export function timelineMoments(timeline: ChangeTimeline): TimelineMoment[] {
  const moments: TimelineMoment[] = [];
  if (timeline.dates.proposed.date) moments.push({ kind: "proposed", at: timeline.dates.proposed.date });

  const byInstant = new Map<number, { at: string; tasks: ChangeTimelineTask[] }>();
  for (const task of [...timeline.tasks].sort((a, b) => a.lineNumber - b.lineNumber)) {
    if (!task.done || !task.date) continue;
    const key = instant(task.date);
    if (!Number.isFinite(key)) continue;
    const group = byInstant.get(key);
    if (group) group.tasks.push(task);
    else byInstant.set(key, { at: task.date, tasks: [task] });
  }
  for (const group of byInstant.values()) moments.push({ kind: "tasks", ...group });

  if (timeline.archived && timeline.dates.archived.date) {
    const { date, day, source } = timeline.dates.archived;
    moments.push(source === "folder-name" && day
      ? { kind: "archived", at: `${day}T23:59:59.999Z`, folder: timeline.changeName, day }
      : { kind: "archived", at: date, folder: timeline.changeName });
  }

  // Stable: at one instant, the proposal comes before tasks and tasks before
  // the archive, the order they were pushed in.
  return moments
    .map((moment, index) => ({ moment, index }))
    .sort((a, b) => instant(a.moment.at) - instant(b.moment.at) || a.index - b.index)
    .map(({ moment }) => moment);
}

const TASK_NUMBER = /^(\d+(?:\.\d+)*)\s+(.*)$/s;

/** A task's whole sentence as a reader sees it: its checkbox line and the
 * lines `tasks.md` wraps it onto, with the bold and code marks Markdown
 * would not show taken off. The first line alone stopped mid-sentence
 * (found by 6.6's live check). */
export function taskSentence(task: Pick<ChangeTimelineTask, "text" | "continued">): string {
  return [task.text, task.continued]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(" ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

/** A task's number and the rest of its text, or its text alone. */
export function taskNumberAndTitle(text: string): { number?: string; title: string } {
  const trimmed = text.trim();
  const match = TASK_NUMBER.exec(trimmed);
  return match ? { number: match[1], title: (match[2] ?? "").trim() } : { title: trimmed };
}

export interface OpenTask {
  task: ChangeTimelineTask;
  stale: boolean;
}

/** Tasks not yet done, in `tasks.md` order, each with whether it has sat
 * untouched past the threshold. */
export function openTasks(timeline: ChangeTimeline, staleThresholdDays: number, now: Date): OpenTask[] {
  return [...timeline.tasks]
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .filter((task) => !task.done)
    .map((task) => ({ task, stale: isTaskStale(task, staleThresholdDays, now) }));
}

/** Done tasks git gave no date, in `tasks.md` order. */
export function undatedDoneTasks(timeline: ChangeTimeline): ChangeTimelineTask[] {
  return [...timeline.tasks].sort((a, b) => a.lineNumber - b.lineNumber).filter((task) => task.done && !task.date);
}

/** A span of time in the words the tile uses: "45 min", "10 h 07 min",
 * "3 d 4 h". */
export function formatSpan(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}

export interface TimelineTile {
  done: number;
  total: number;
  /** "proposed to archived in 10 h 07 min", or absent without both dates. */
  span?: string;
}

/** The Tasks tile: done of total, and how long the change took from its
 * proposal to its archive, or to its last work while it is active. */
export function timelineTile(timeline: ChangeTimeline): TimelineTile {
  const done = timeline.tasks.filter((task) => task.done).length;
  const tile: TimelineTile = { done, total: timeline.tasks.length };
  const from = timeline.dates.proposed.date;
  const to = timeline.archived ? timeline.dates.archived.date : timeline.dates.lastWorked.date;
  if (from && to && instant(to) >= instant(from)) {
    tile.span = `proposed to ${timeline.archived ? "archived" : "last worked"} in ${formatSpan(instant(to) - instant(from))}`;
  }
  return tile;
}

const SOURCE_WORDS: Record<ChangeDateSource, string> = {
  "git-commit": "from a git commit",
  "git-blame": "from git blame on tasks.md",
  "audit-log": "from the audit log",
  "folder-name": "from the archive folder's name",
  unreadable: "could not be read",
  none: "not recorded",
};

export interface TimelineDateRow {
  label: string;
  fact: DatedFact;
  /** The date as the panel reads it, absent where there is none: a day
   * alone where the source holds no time. */
  when?: string;
  source: string;
}

/** The Dates panel's four rows, each with where its date was read from. */
export function timelineDates(timeline: ChangeTimeline, timeZone?: string): TimelineDateRow[] {
  const { proposed, firstWorked, lastWorked, archived } = timeline.dates;
  const rows: Array<[string, DatedFact]> = [
    ["Proposed", proposed],
    ["First worked", firstWorked],
    ["Last worked", lastWorked],
    ["Archived", archived],
  ];
  return rows
    // An active change has no archive to speak of.
    .filter(([label]) => label !== "Archived" || timeline.archived)
    .map(([label, fact]) => {
      const when = fact.source === "folder-name" && fact.day
        ? formatMomentDay(fact.day)
        : fact.date ? formatMoment(fact.date, timeZone) : undefined;
      return { label, fact, ...(when !== undefined ? { when } : {}), source: SOURCE_WORDS[fact.source] };
    });
}

/** "Sun 13 Sep, 18:40", in the given time zone or the viewer's. The parts
 * come from `en-US`, whose short month is three letters in every ICU build
 * (`en-GB`'s reads "Sept"), and are put in the mockup's order here. */
export function formatMoment(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(timeZone !== undefined ? { timeZone } : {}),
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}, ${part("hour")}:${part("minute")}`;
}

/** "Mon 14 Sep", for a date that carries a day and no time. `day` is the
 * `YYYY-MM-DD` the record states; it is read as that calendar day, never
 * shifted into a zone. */
export function formatMomentDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}
