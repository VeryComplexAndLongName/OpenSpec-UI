// 2.1 Presentational, transport-agnostic (props only) — the host fetches
// timelines for a date range and passes them in. See
// openspec/changes/add-multi-change-timeline-view/design.md.
//
// One picture over one axis of days (the-web-ui-screens-wear-metro 2.3): a
// sticky column names the change, a row of dates runs along the top, and an
// event sits in the column of the day it happened. It replaces a log-scaled
// lane, whose position no reader could turn back into a date.

import type { ChangeTimeline } from "../change-timeline-client.js";

export interface MultiChangeTimelineViewProps {
  timelines: ChangeTimeline[];
  rangeStart: string;
  rangeEnd: string;
}

interface TimelinePoint {
  kind: "created" | "task" | "archived";
  label: string;
  date: string;
}

function pointsFor(timeline: ChangeTimeline): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  if (timeline.createdDate) {
    points.push({ kind: "created", label: "Created", date: timeline.createdDate });
  }
  for (const task of timeline.tasks) {
    if (task.date) points.push({ kind: "task", label: task.text, date: task.date });
  }
  if (timeline.archived) {
    const archived = timeline.dates.archived;
    // The commit that archived it carries a time of day, so it plots
    // where it happened. The end-of-day anchor below is for the case it
    // was written for and no longer the common one: a date read off the
    // folder name has no time, and plotting it at midnight would put
    // archiving *before* that same day's task ticks. See
    // charts-over-what-happened.
    if (archived.source === "git-commit" && archived.date) {
      points.push({ kind: "archived", label: "Archived", date: archived.date });
    } else if (timeline.archivedDate) {
      points.push({ kind: "archived", label: "Archived", date: `${timeline.archivedDate}T23:59:59.999Z` });
    }
  }
  return points;
}

const KIND_MARKER: Record<TimelinePoint["kind"], string> = {
  created: "▶",
  task: "●",
  archived: "■",
};

/** The day a moment falls on, as `YYYY-MM-DD` in the viewer's own zone: the
 * axis is read in local days, so an event must land in the local column it
 * belongs to rather than UTC's. */
export function dayKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Every day from the start to the end of the range, inclusive. The axis is
 * the whole range even where nothing happened, so a gap reads as a gap. */
export function daysOf(rangeStart: string, rangeEnd: string): string[] {
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const days: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  // A year of days is 365 columns, which the scroller handles; a range
  // wider than a decade is a mistake rather than a picture, and stops here.
  for (let guard = 0; cursor <= last && guard < 4000; guard += 1) {
    days.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function shortDay(day: string): string {
  const [year, month, date] = day.split("-").map((part) => Number(part));
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function MultiChangeTimelineView({ timelines, rangeStart, rangeEnd }: MultiChangeTimelineViewProps) {
  const days = daysOf(rangeStart, rangeEnd);
  const columnOf = new Map(days.map((day, index) => [day, index + 2]));

  return (
    <div className="openspec-multi-timeline" data-testid="multi-change-timeline-view">
      {timelines.length === 0 ? (
        <p>No changes selected.</p>
      ) : (
        <div
          className="openspec-multi-timeline-scroll"
          tabIndex={0}
          role="region"
          aria-label="Changes over time, scrolls sideways"
        >
          <div className="openspec-multi-timeline-grid" style={{ "--days": days.length } as React.CSSProperties}>
            <span className="openspec-multi-timeline-corner" aria-hidden="true" />
            {days.map((day) => (
              <span className="openspec-multi-timeline-day" key={day} data-day={day}>
                {shortDay(day)}
              </span>
            ))}
            {timelines.map((timeline) => (
              <div className="openspec-multi-timeline-row" key={timeline.changeName} data-testid={`multi-timeline-lane-${timeline.changeName}`}>
                <span className="openspec-multi-timeline-lane-label">{timeline.changeName}</span>
                {pointsFor(timeline).map((point, index) => {
                  const day = dayKey(point.date);
                  const column = columnOf.get(day);
                  if (column === undefined) return null;
                  return (
                    <span
                      key={`${point.kind}-${index}-${point.date}`}
                      className={`openspec-multi-timeline-point openspec-multi-timeline-point-${point.kind}`}
                      style={{ gridColumn: column }}
                      data-day={day}
                      title={`${point.label} — ${new Date(point.date).toLocaleString()}`}
                    >
                      {KIND_MARKER[point.kind]}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
