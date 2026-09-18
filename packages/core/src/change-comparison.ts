// What the Timeline's comparison draws: which days it covers, where each
// change's bar begins and ends on them, and the words beside them
// (the-timeline-compares-changes).
//
// Pure, and a leaf: no git, no filesystem, so both hosts draw the same
// picture from the spans one of them read. Every position is a percentage
// of the window, derived here and never measured in the browser — the
// rule the Pipeline's picture follows (ADR 0025), for the same reason: a
// panel is 1180 pixels wide in the browser and 900 in an editor pane, and
// a length computed against one of them is wrong in the other.
//
// Days are the reader's own days. A change proposed at half past eleven
// at night belongs in that evening's column for the person reading, which
// is what a comparison is read against — not in UTC's next one.

import type { ChangeSpan } from "./change-spans.js";
import type { DatedFact } from "./change-dates.js";
import { withoutArchivePrefix } from "./change-dates.js";

export type ComparisonPeriodId = "2-days" | "5-days" | "2-weeks" | "all";

export interface ComparisonPeriod {
  id: ComparisonPeriodId;
  /** What the segmented control shows. */
  label: string;
  /** How many days the window covers, counting today; `null` for the
   * period that covers whatever history there is. */
  days: number | null;
}

/** The periods the mockup's segmented control offers, in its order. */
export const COMPARISON_PERIODS: readonly ComparisonPeriod[] = [
  { id: "2-days", label: "2 days", days: 2 },
  { id: "5-days", label: "5 days", days: 5 },
  { id: "2-weeks", label: "2 weeks", days: 14 },
  { id: "all", label: "All", days: null },
];

export const DEFAULT_COMPARISON_PERIOD: ComparisonPeriodId = "5-days";

/** A day the grid draws a column for. */
export interface ComparisonDay {
  /** `YYYY-MM-DD` in the reader's own zone. */
  day: string;
  /** "Sat 12 Sep" — what the column is called, whatever it shows. */
  heading: string;
  /** What fits in the column at this window's width: the heading over a
   * few days, the day and month over a couple of weeks, the date alone
   * over more — with the month kept where it changes, so a reader can
   * still tell one from the next. */
  label: string;
  /** Saturday or Sunday: the columns the grid shades. */
  weekend: boolean;
  /** The instants this column begins and ends at, so a bar's position
   * inside it is exact through a daylight-saving change — an hour lost
   * or gained makes a day 23 or 25 hours long, and a column is a column
   * either way. */
  start: number;
  end: number;
}

export interface ComparisonWindow {
  start: number;
  end: number;
  days: ComparisonDay[];
  /** How wide one day's column is, in rem — derived here rather than left
   * to the stylesheet, because it is what decides which label fits. A
   * five-day window gives a day the room for "Sat 12 Sep"; a window of
   * months gives it the room for a bar (ADR 0025: derived, not
   * measured). */
  dayRem: number;
}

/** Beyond this many columns a grid is not a picture of anything, and a
 * repository with a broken date could otherwise ask for millions. Ten
 * years of days, as the cut-off rather than as a target. */
const MOST_DAYS = 3660;

/** The window a period covers, ending with the day `now` falls in.
 *
 * `all` begins at the earliest day any change was proposed on, so the
 * whole history is one press away; with nothing dated, it is today
 * alone. */
export function comparisonWindow(
  period: ComparisonPeriodId,
  spans: readonly ChangeSpan[],
  now: number,
): ComparisonWindow {
  const today = startOfDay(now);
  const chosen = COMPARISON_PERIODS.find((candidate) => candidate.id === period);
  const first = chosen?.days != null
    ? addDays(today, -(Math.max(1, chosen.days) - 1))
    : earliestProposedDay(spans, today);
  const starts: number[] = [];
  for (let start = Math.min(first, today); start <= today && starts.length < MOST_DAYS; start = addDays(start, 1)) {
    starts.push(start);
  }
  const width = dayWidthFor(starts.length);
  const days = starts.map((start, index) => describeDay(start, width, index === 0 ? undefined : starts[index - 1] as number));
  const firstDay = days[0] as ComparisonDay;
  const lastDay = days[days.length - 1] as ComparisonDay;
  return { start: firstDay.start, end: lastDay.end, days, dayRem: width.rem };
}

/** How much room one day gets, and how much of its name fits in it.
 *
 * Three steps rather than a formula: a column either has the room for a
 * weekday, a month, or a number, and a width between them buys a
 * half-drawn word. */
interface DayWidth {
  rem: number;
  shows: "heading" | "day-and-month" | "date";
}

function dayWidthFor(days: number): DayWidth {
  if (days <= 7) return { rem: 7, shows: "heading" };
  if (days <= 21) return { rem: 3.5, shows: "day-and-month" };
  // Wide enough for the month a changed one carries, which is what the
  // live check at All found clipped to an ellipsis at 2.25rem.
  return { rem: 2.75, shows: "date" };
}

function earliestProposedDay(spans: readonly ChangeSpan[], today: number): number {
  let earliest: number | undefined;
  for (const span of spans) {
    const proposed = instantOf(span.dates.proposed);
    if (proposed === null) continue;
    if (earliest === undefined || proposed < earliest) earliest = proposed;
  }
  return earliest === undefined ? today : startOfDay(earliest);
}

/** Where a change's bar sits, as percentages of the window. */
export interface ComparisonBar {
  from: number;
  to: number;
  /** The change began before the window, or had not ended when it
   * closed: the bar is cut rather than starting or ending there, and the
   * view draws that edge square. */
  clippedStart: boolean;
  clippedEnd: boolean;
}

export interface ComparisonRow {
  /** The change's directory name — an archived one keeps its date
   * prefix, which is how every other reading names it and how a host
   * asks for it again. */
  changeName: string;
  /** What the row shows: the name without that prefix. */
  name: string;
  active: boolean;
  /** `null` for a change carrying no readable proposed date: it keeps
   * its row and says so, rather than being drawn at a guessed day. */
  bar: ComparisonBar | null;
  /** "47 tasks" for an archived change, "25 / 27" for an active one,
   * "no tasks" where there is no list. */
  label: string;
  /** The row without the picture: what a reader who cannot see the bar
   * is told, and what the view uses as the row's accessible name. */
  description: string;
}

/** One row per change whose span meets the window, oldest proposal
 * first.
 *
 * `filter` narrows by a case-insensitive part of the change's directory
 * name, so an archived change is found by its date prefix as well as by
 * its name. */
export function comparisonRows(
  spans: readonly ChangeSpan[],
  window: ComparisonWindow,
  now: number,
  filter = "",
): ComparisonRow[] {
  const wanted = filter.trim().toLowerCase();
  const rows: Array<{ row: ComparisonRow; at: number | null }> = [];
  for (const span of spans) {
    if (wanted.length > 0 && !span.changeName.toLowerCase().includes(wanted)) continue;
    const proposed = instantOf(span.dates.proposed);
    const archived = instantOf(span.dates.archived);
    const active = !span.archived;
    const ends = active ? now : archived;
    // A change meets the window when some part of its span is inside it.
    // An active change with no archiving runs to now, which is where the
    // dashed line is.
    const meets = proposed !== null
      ? proposed < window.end && (ends === null || ends > window.start)
      : archived !== null
        ? archived >= window.start && archived <= window.end
        : active && now <= window.end;
    if (!meets) continue;

    rows.push({
      at: proposed,
      row: {
        changeName: span.changeName,
        name: withoutArchivePrefix(span.changeName),
        active,
        bar: proposed === null ? null : barOf(window, proposed, ends ?? window.end),
        label: labelOf(span),
        description: describeRow(span, active),
      },
    });
  }
  // Oldest proposal first, as the artboard lists them; a change with no
  // proposed date has no place in that order and goes last, by name.
  rows.sort((left, right) => {
    if (left.at === null || right.at === null) {
      if (left.at !== right.at) return left.at === null ? 1 : -1;
      return left.row.changeName.localeCompare(right.row.changeName);
    }
    if (left.at !== right.at) return left.at - right.at;
    return left.row.changeName.localeCompare(right.row.changeName);
  });
  return rows.map((entry) => entry.row);
}

function barOf(window: ComparisonWindow, from: number, to: number): ComparisonBar {
  const clippedStart = from < window.start;
  const clippedEnd = to > window.end;
  const start = offsetOf(window, Math.max(from, window.start));
  const end = offsetOf(window, Math.min(Math.max(to, from), window.end));
  return { from: start, to: Math.max(end, start), clippedStart, clippedEnd };
}

/** Which side of a bar its figures go on.
 *
 * After it, except where the bar ends so near the right edge that the
 * words would run off the grid — and then only where there is room in
 * front of it. A bar spanning the whole window has nowhere to put them
 * and keeps them after, where they are clipped rather than lost. */
export function labelSide(row: ComparisonRow): "after" | "before" {
  if (!row.bar) return "after";
  return row.bar.to > LABEL_FITS_UNTIL && row.bar.from > LABEL_NEEDS_BEFORE ? "before" : "after";
}

const LABEL_FITS_UNTIL = 80;
const LABEL_NEEDS_BEFORE = 20;

/** Where now falls in the window, or `null` when it is outside it. */
export function nowOffset(window: ComparisonWindow, now: number): number | null {
  if (now < window.start || now > window.end) return null;
  return offsetOf(window, now);
}

/** The sentence under the page head: how many changes are drawn, over
 * which days, and what a bar means. */
export function describeComparison(
  rows: readonly ComparisonRow[],
  window: ComparisonWindow,
  now: number,
): string {
  const first = window.days[0];
  const last = window.days[window.days.length - 1];
  const changes = `${rows.length} ${rows.length === 1 ? "change" : "changes"}`;
  if (!first || !last) return `${changes} · each bar runs from proposed to archived`;
  const until = last.start <= now && now <= last.end ? "today" : last.heading;
  const between = first.day === last.day ? `on ${first.heading}` : `between ${first.heading} and ${until}`;
  return `${changes} ${between} · each bar runs from proposed to archived`;
}

/** A date as the rows say it: "Sat 12 Sep, 12:36", or the day alone for
 * a date read from a folder name, which carries no time of day. */
export function comparisonMoment(fact: DatedFact): string | null {
  if (fact.date === null) return null;
  const at = new Date(fact.date);
  const day = `${WEEKDAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
  if (fact.source === "folder-name") return day;
  return `${day}, ${two(at.getHours())}:${two(at.getMinutes())}`;
}

function labelOf(span: ChangeSpan): string {
  if (!span.tasks) return "no tasks";
  if (span.archived) return `${span.tasks.total} ${span.tasks.total === 1 ? "task" : "tasks"}`;
  return `${span.tasks.done} / ${span.tasks.total}`;
}

function describeRow(span: ChangeSpan, active: boolean): string {
  const parts = [withoutArchivePrefix(span.changeName), active ? "active" : "archived"];
  const proposed = comparisonMoment(span.dates.proposed);
  parts.push(proposed === null ? "no proposed date" : `proposed ${proposed}`);
  const archived = comparisonMoment(span.dates.archived);
  if (archived !== null) parts.push(`archived ${archived}`);
  parts.push(labelOf(span));
  return parts.join(", ");
}

/** Where an instant sits in the window, as a percentage.
 *
 * Measured in columns rather than in milliseconds: every column is one
 * day wide on the screen, and the day a clock change makes 23 hours long
 * is one column too. Dividing the window's span would slide every bar
 * after such a day by an hour. */
function offsetOf(window: ComparisonWindow, at: number): number {
  const days = window.days.length;
  if (days === 0) return 0;
  if (at <= window.start) return 0;
  if (at >= window.end) return 100;
  let index = 0;
  while (index < days - 1 && at >= (window.days[index] as ComparisonDay).end) index += 1;
  const day = window.days[index] as ComparisonDay;
  const within = (at - day.start) / Math.max(1, day.end - day.start);
  return round((index + Math.min(Math.max(within, 0), 1)) / days * 100);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function instantOf(fact: DatedFact): number | null {
  if (fact.date === null) return null;
  const at = Date.parse(fact.date);
  return Number.isNaN(at) ? null : at;
}

function describeDay(start: number, width: DayWidth, previous: number | undefined): ComparisonDay {
  const at = new Date(start);
  const weekday = at.getDay();
  const heading = `${WEEKDAYS[weekday]} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
  // The month is kept on the first column and wherever it changes, even
  // at the narrowest width: a run of bare numbers says nothing about
  // where one month ended.
  const monthChanged = previous === undefined || new Date(previous).getMonth() !== at.getMonth();
  const label = width.shows === "heading"
    ? heading
    : width.shows === "day-and-month" || monthChanged
      ? `${at.getDate()} ${MONTHS[at.getMonth()]}`
      : `${at.getDate()}`;
  return {
    day: `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`,
    heading,
    label,
    weekend: weekday === 0 || weekday === 6,
    start,
    end: addDays(start, 1),
  };
}

function startOfDay(at: number): number {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function addDays(at: number, days: number): number {
  const day = new Date(at);
  day.setDate(day.getDate() + days);
  return day.getTime();
}

function two(value: number): string {
  return `${value}`.padStart(2, "0");
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
