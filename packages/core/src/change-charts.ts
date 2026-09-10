// What the charts plot, computed from the timelines the host already
// loaded.
//
// Pure and separate from the component for the reason every other
// calculation here is: a chart that gets its arithmetic wrong is a
// picture of a wrong number, and a picture is harder to disbelieve than
// a table. See charts-over-what-happened.
//
// In core rather than in `webui`, and a leaf module with no Node import
// so `browser.ts` can carry it: this is arithmetic over core's own
// timeline, and the sprint report on the server would otherwise have to
// duplicate it to print the same figures. Only the `type` imports below
// reach `change-timeline.js`, which does read git — a type import is
// erased, and `browser.ts` already re-exports these same types. See
// a-date-is-one-day-in-every-source.
//
// Which charts exist was measured before it was decided. Over this
// repository: 178 changes archived across 19 days, up to 24 in one, and
// lead times of median 0.22d / p90 3.14d / max 10.17d — both worth
// drawing. The work span and the wait before work are flat and are
// deliberately not here: a flat chart reads as a finding. How flat they
// are is no longer a constant in a sentence — see
// `describeWorkDurationNotCharted`.

import type { ChangeDateSource } from "./change-dates.js";
import type { ChangeTimeline } from "./change-timeline.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** What a chart rests on, carried with every chart rather than left to a
 * caption someone forgets to update.
 *
 * The source counts are the point: a date from the commit that archived
 * a change and a date read off its directory name plot identically, and
 * only one of them survives someone renaming the directory. */
export interface ChartBasis {
  /** Changes that contributed a value. */
  drawn: number;
  /** Changes left out because they carried no date to draw. Counted
   * rather than quietly dropped — "nothing to plot here" and "nothing
   * happened here" are different facts. */
  excluded: number;
  /** How many of the drawn dates came from each source. */
  bySource: Partial<Record<ChangeDateSource, number>>;
  /** Of the excluded, how many were excluded because what was recorded
   * could not be read as a date — a folder prefix with a typo in it,
   * say. A subset of `excluded`, not a second count beside it: nothing
   * to read and unreadable are different facts about a record, and a
   * chart that says only "left out" hides a defect behind a gap. */
  unreadable?: number;
  /** Lines the one-call archive read could not understand, when the
   * host reported any. Absent when it understood everything, which is
   * the normal case; present, it says the dates below rest partly on a
   * per-change fallback rather than on the batch read. */
  unreadableArchiveLines?: number;
}

export interface DayCount {
  /** `YYYY-MM-DD`. */
  day: string;
  count: number;
}

export interface ArchivedPerDay {
  days: DayCount[];
  basis: ChartBasis;
}

export interface LeadTimeBucket {
  label: string;
  count: number;
}

export interface LeadTimes {
  buckets: LeadTimeBucket[];
  basis: ChartBasis;
}

function emptyBasis(): ChartBasis {
  return { drawn: 0, excluded: 0, bySource: {} };
}

function countSource(basis: ChartBasis, source: ChangeDateSource): void {
  basis.bySource[source] = (basis.bySource[source] ?? 0) + 1;
  basis.drawn += 1;
}

/** Left out, and why — `unreadable` only when the record said something
 * and it was not a date. */
function countExcluded(basis: ChartBasis, ...sources: readonly ChangeDateSource[]): void {
  basis.excluded += 1;
  if (sources.includes("unreadable")) basis.unreadable = (basis.unreadable ?? 0) + 1;
}

/** The largest count of unread archive-log lines any of these timelines
 * reports. One number for the batch, repeated on each timeline of it —
 * the maximum rather than a sum so a batch is not multiplied by its own
 * size. */
function unreadableArchiveLines(timelines: readonly ChangeTimeline[]): number {
  let most = 0;
  for (const timeline of timelines) {
    most = Math.max(most, timeline.archiveDatesUnreadableLines ?? 0);
  }
  return most;
}

function withArchiveReadNote(basis: ChartBasis, timelines: readonly ChangeTimeline[]): ChartBasis {
  const unread = unreadableArchiveLines(timelines);
  return unread > 0 ? { ...basis, unreadableArchiveLines: unread } : basis;
}

/** Every day from the first to the last, so a day nobody archived
 * anything on is a gap in the bars rather than a column that is not
 * there. A chart that skips empty days compresses time and makes a quiet
 * week look like a busy one.
 *
 * The day is the fact's own `day`, never a slice of its instant: an
 * archive committed at 02:30 in Moscow belongs to the column its folder
 * name gives it, not to the one the UTC clock would. */
export function archivedPerDay(timelines: readonly ChangeTimeline[]): ArchivedPerDay {
  const basis = emptyBasis();
  const counts = new Map<string, number>();

  for (const timeline of timelines) {
    if (!timeline.archived) continue;
    const fact = timeline.dates.archived;
    if (!fact.day) {
      countExcluded(basis, fact.source);
      continue;
    }
    counts.set(fact.day, (counts.get(fact.day) ?? 0) + 1);
    countSource(basis, fact.source);
  }

  const withNote = withArchiveReadNote(basis, timelines);
  if (counts.size === 0) return { days: [], basis: withNote };

  const ordered = [...counts.keys()].sort();
  const days: DayCount[] = [];
  const last = new Date(`${ordered[ordered.length - 1]}T00:00:00.000Z`).getTime();
  for (let at = new Date(`${ordered[0]}T00:00:00.000Z`).getTime(); at <= last; at += DAY_MS) {
    const day = new Date(at).toISOString().slice(0, 10);
    days.push({ day, count: counts.get(day) ?? 0 });
  }
  return { days, basis: withNote };
}

/** Buckets a person reads, not equal-width bins. Sized from the measured
 * distribution — median 0.22d, p90 3.14d — so most of the mass is not in
 * one bar.
 *
 * Named by their boundaries. The first was "Same day", which is a claim
 * about the calendar that a floor of twenty-four hours does not make:
 * a change proposed at 22:00 and archived at 14:00 the next afternoon
 * fell in it. A bucket's name says what it measures. */
export const LEAD_BUCKETS: ReadonlyArray<{ label: string; upToDays: number }> = [
  { label: "Under a day", upToDays: 1 },
  { label: "1–2 days", upToDays: 2 },
  { label: "2–3 days", upToDays: 3 },
  { label: "3–8 days", upToDays: 8 },
  { label: "8 days or more", upToDays: Number.POSITIVE_INFINITY },
];

/** How long each change took from being proposed to being archived.
 *
 * Both ends must be known: a change proposed but not archived has not
 * taken its time yet, and one archived without a readable proposal date
 * would be a span measured from a guess.
 *
 * Measured between the instants, not between the days: two instants
 * subtract correctly whatever offset each was recorded in, and rounding
 * both to a day first would put a span of two hours across midnight in
 * the same bucket as one of twenty-two. */
export function leadTimes(timelines: readonly ChangeTimeline[]): LeadTimes {
  const basis = emptyBasis();
  const counts = LEAD_BUCKETS.map((bucket) => ({ label: bucket.label, count: 0 }));

  for (const timeline of timelines) {
    if (!timeline.archived) continue;
    const from = timeline.dates.proposed;
    const to = timeline.dates.archived;
    if (!from.date || !to.date) {
      countExcluded(basis, from.source, to.source);
      continue;
    }
    const spanDays = (new Date(to.date).getTime() - new Date(from.date).getTime()) / DAY_MS;
    // A negative span is a repository whose history was rewritten, not a
    // change that was archived before it was proposed. Clamped rather
    // than dropped: it happened, and it took no time worth reporting.
    const index = LEAD_BUCKETS.findIndex((bucket) => Math.max(spanDays, 0) < bucket.upToDays);
    (counts[index === -1 ? counts.length - 1 : index] as LeadTimeBucket).count += 1;
    // The weaker of the two sources is what the span rests on: a span
    // between a commit and a folder name is only as good as the folder
    // name.
    countSource(basis, to.source === "git-commit" ? from.source : to.source);
  }

  return { buckets: counts, basis: withArchiveReadNote(basis, timelines) };
}

/** The sentence under a chart. Says what it drew, what it left out, and
 * how much of it is a measurement rather than a convention — in the
 * chart, not in a caption someone has to remember to update. */
export function describeBasis(basis: ChartBasis): string {
  if (basis.drawn === 0 && basis.excluded === 0) return "Nothing to draw yet.";
  const parts = [`${basis.drawn} ${basis.drawn === 1 ? "change" : "changes"}`];
  const fromCommit = basis.bySource["git-commit"] ?? 0;
  const fromFolder = basis.bySource["folder-name"] ?? 0;
  if (fromCommit > 0) parts.push(`${fromCommit} dated from a commit`);
  if (fromFolder > 0) parts.push(`${fromFolder} from a folder name`);
  if (basis.excluded > 0) {
    // "Left out" and "left out because the record is broken" are
    // different facts, and the second one is a defect someone can fix.
    parts.push(basis.unreadable
      ? `${basis.excluded} left out for having no date, ${basis.unreadable} of them unreadable`
      : `${basis.excluded} left out for having no date`);
  }
  const sentence = `${parts.join(" · ")}.`;
  // Said here rather than logged: a batch read that fell short sends
  // every affected change to a per-change git call, which is slow and
  // correct, and nothing else would ever mention it.
  return basis.unreadableArchiveLines
    ? `${sentence} ${basis.unreadableArchiveLines} archive log ${basis.unreadableArchiveLines === 1 ? "line was" : "lines were"} unreadable; those dates were read one change at a time.`
    : sentence;
}

/** The share of changes that must have taken no measurable time before
 * the work-duration chart is withheld as flat.
 *
 * A judgement, stated so it can be disagreed with rather than guessed:
 * half. Over this repository the figure that prompted the decision was
 * far past it — 135 of 185 — but the decision has to be made against
 * whatever workspace is open, not against that one. */
export const FLAT_WORK_SHARE = 0.5;

export interface WorkDurationBasis {
  /** Changes carrying both a proposal date and a first finished task,
   * so that a span between them exists at all. */
  measured: number;
  /** Of those, how many span exactly zero days. */
  flat: number;
}

/** How long the work itself took, over the changes shown — the figure
 * behind the chart that is deliberately not drawn. */
export function workDurationBasis(timelines: readonly ChangeTimeline[]): WorkDurationBasis {
  let measured = 0;
  let flat = 0;
  for (const timeline of timelines) {
    const from = timeline.dates.proposed;
    const to = timeline.dates.firstWorked;
    if (!from.day || !to.day) continue;
    measured += 1;
    if (from.day === to.day) flat += 1;
  }
  return { measured, flat };
}

/** The sentence in place of the work-duration chart, computed from the
 * changes on screen.
 *
 * It used to be a constant reading "measured over this repository, 135
 * of 185 changes have exactly zero days…", rendered in every workspace
 * — so a user of another repository read "this repository" as theirs
 * and a number that had nothing to do with it. An absence still has to
 * be explained; it has to be explained about the thing being looked at.
 * See a-date-is-one-day-in-every-source. */
export function describeWorkDurationNotCharted(timelines: readonly ChangeTimeline[]): string {
  const { measured, flat } = workDurationBasis(timelines);
  const lead = "How long the work itself took is not charted";
  if (measured === 0) {
    return `${lead}: no change here carries both a proposal date and a finished task to measure it between.`;
  }
  const counted = `${flat} of ${measured} ${measured === 1 ? "change has" : "changes have"} exactly zero days`
    + " between being proposed and their first finished task";
  const threshold = `${Math.round(FLAT_WORK_SHARE * 100)}%`;
  return flat / measured >= FLAT_WORK_SHARE
    ? `${lead}: ${counted}. Past ${threshold} the chart would be a flat line presented as a finding.`
    : `${lead}: ${counted} — under the ${threshold} that makes it flat, but it stays undrawn until someone`
      + " decides otherwise in a change of their own.";
}
