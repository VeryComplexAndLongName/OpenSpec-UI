// What the OpenSpec view summary shows, worked out from what it read
// (the-summary-looks-like-the-mockup, ADR 0033): the four tiles' figures and
// notes, and the two short lists beside each other. Pure, so the summary's
// arithmetic is tested against a written overview rather than a browser.

export interface SummaryChange {
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastModified?: string;
}

export interface SummarySpec {
  id: string;
  requirementCount: number;
}

export interface SummaryOverview {
  changes: readonly SummaryChange[];
  specs: readonly SummarySpec[];
  archivedChangeSummaries: readonly SummaryChange[];
}

/** The waiting items, as far as the summary needs them: `null` while the
 * inbox has not been read. */
export type SummaryWaiting = ReadonlyArray<{ waitingOn: { kind: string } }> | null;

export interface SummaryTile {
  key: "changes" | "archived" | "specs" | "waiting";
  label: string;
  value: number | string;
  note: string;
}

export interface RecentlyArchived {
  name: string;
  /** The archived name without its date prefix. */
  title: string;
  completedTasks: number;
  totalTasks: number;
  /** The day it was archived: the name's prefix, or its last modification. */
  day: string;
}

export interface SummaryFigures {
  tiles: SummaryTile[];
  topSpecs: SummarySpec[];
  recentlyArchived: RecentlyArchived[];
}

export const TOP_SPECS = 6;
export const RECENTLY_ARCHIVED = 5;

const ARCHIVE_PREFIX = /^(\d{4}-\d{2}-\d{2})-(.+)$/u;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "16 Sep" for an ISO timestamp or a `YYYY-MM-DD` day; the value as given
 * when it is not a date. A bare day is read as that calendar day, not as UTC
 * midnight shifted into the viewer's zone. */
export function formatDay(value: string): string {
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (bare) return `${Number(bare[3])} ${MONTHS[Number(bare[2]) - 1] ?? ""}`.trim();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function archivedDay(change: SummaryChange): string {
  return ARCHIVE_PREFIX.exec(change.name)?.[1] ?? change.lastModified ?? "";
}

export function summaryFigures(overview: SummaryOverview, waiting: SummaryWaiting): SummaryFigures {
  const archived = [...overview.archivedChangeSummaries]
    .map((change) => ({
      name: change.name,
      title: ARCHIVE_PREFIX.exec(change.name)?.[2] ?? change.name,
      completedTasks: change.completedTasks,
      totalTasks: change.totalTasks,
      day: archivedDay(change),
    }))
    .sort((left, right) => right.day.localeCompare(left.day) || left.name.localeCompare(right.name));
  const requirements = overview.specs.reduce((sum, spec) => sum + spec.requirementCount, 0);
  const onAPerson = waiting?.filter((item) => item.waitingOn.kind === "person").length ?? null;

  return {
    tiles: [
      { key: "changes", label: "Changes", value: overview.changes.length, note: "active" },
      {
        key: "archived",
        label: "Archived",
        value: archived.length,
        note: archived[0] ? `latest ${formatDay(archived[0].day)}` : "none yet",
      },
      { key: "specs", label: "Specs", value: overview.specs.length, note: `${requirements} ${requirements === 1 ? "requirement" : "requirements"}` },
      {
        key: "waiting",
        label: "Waiting on you",
        value: onAPerson ?? "…",
        note: onAPerson === null ? "not read yet" : onAPerson === 0 ? "nothing is waiting" : `${onAPerson} ${onAPerson === 1 ? "item" : "items"} to look at`,
      },
    ],
    topSpecs: [...overview.specs]
      .sort((left, right) => right.requirementCount - left.requirementCount || left.id.localeCompare(right.id))
      .slice(0, TOP_SPECS),
    recentlyArchived: archived.slice(0, RECENTLY_ARCHIVED),
  };
}
