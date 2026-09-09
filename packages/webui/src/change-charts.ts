// What the charts plot, computed from the timelines the host already
// loaded.
//
// Pure and separate from the component for the reason every other
// calculation here is: a chart that gets its arithmetic wrong is a
// picture of a wrong number, and a picture is harder to disbelieve than
// a table. See charts-over-what-happened.
//
// Which charts exist was measured before it was decided. Over this
// repository: 178 changes archived across 19 days, up to 24 in one, and
// lead times of median 0.22d / p90 3.14d / max 10.17d — both worth
// drawing. The work span and the wait before work are flat (135 of 185
// changes have exactly zero days from proposal to first tick) and are
// deliberately not here: a flat chart reads as a finding.

import type { ChangeDateSource, ChangeTimeline } from "@openspec-ui/core/browser";

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

/** Every day from the first to the last, so a day nobody archived
 * anything on is a gap in the bars rather than a column that is not
 * there. A chart that skips empty days compresses time and makes a quiet
 * week look like a busy one. */
export function archivedPerDay(timelines: readonly ChangeTimeline[]): ArchivedPerDay {
  const basis = emptyBasis();
  const counts = new Map<string, number>();

  for (const timeline of timelines) {
    if (!timeline.archived) continue;
    const fact = timeline.dates.archived;
    if (!fact.date) {
      basis.excluded += 1;
      continue;
    }
    const day = fact.date.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
    countSource(basis, fact.source);
  }

  if (counts.size === 0) return { days: [], basis };

  const ordered = [...counts.keys()].sort();
  const days: DayCount[] = [];
  const last = new Date(`${ordered[ordered.length - 1]}T00:00:00.000Z`).getTime();
  for (let at = new Date(`${ordered[0]}T00:00:00.000Z`).getTime(); at <= last; at += DAY_MS) {
    const day = new Date(at).toISOString().slice(0, 10);
    days.push({ day, count: counts.get(day) ?? 0 });
  }
  return { days, basis };
}

/** Buckets a person reads, not equal-width bins. Sized from the measured
 * distribution — median 0.22d, p90 3.14d — so most of the mass is not in
 * one bar. */
const LEAD_BUCKETS: ReadonlyArray<{ label: string; upToDays: number }> = [
  { label: "Same day", upToDays: 1 },
  { label: "1 day", upToDays: 2 },
  { label: "2 days", upToDays: 3 },
  { label: "3–7 days", upToDays: 8 },
  { label: "Over a week", upToDays: Number.POSITIVE_INFINITY },
];

/** How long each change took from being proposed to being archived.
 *
 * Both ends must be known: a change proposed but not archived has not
 * taken its time yet, and one archived without a readable proposal date
 * would be a span measured from a guess. */
export function leadTimes(timelines: readonly ChangeTimeline[]): LeadTimes {
  const basis = emptyBasis();
  const counts = LEAD_BUCKETS.map((bucket) => ({ label: bucket.label, count: 0 }));

  for (const timeline of timelines) {
    if (!timeline.archived) continue;
    const from = timeline.dates.proposed;
    const to = timeline.dates.archived;
    if (!from.date || !to.date) {
      basis.excluded += 1;
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

  return { buckets: counts, basis };
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
  if (basis.excluded > 0) parts.push(`${basis.excluded} left out for having no date`);
  return `${parts.join(" · ")}.`;
}
