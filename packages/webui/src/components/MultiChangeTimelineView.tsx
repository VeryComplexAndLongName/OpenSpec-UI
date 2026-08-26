// 2.1 Presentational, transport-agnostic (props only) — the host fetches
// timelines for a date range and passes them in. See
// openspec/changes/add-multi-change-timeline-view/design.md.

import { logPosition } from "../timeline-scale.js";
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
  if (timeline.archived && timeline.archivedDate) {
    // Archiving is chronologically the last thing that happens to a
    // change, but `archivedDate` is a plain calendar date (parsed from
    // the archive folder name, no time-of-day available) — anchoring it
    // to end-of-day rather than midnight avoids it plotting *before*
    // that same day's actual created/task timestamps.
    points.push({ kind: "archived", label: "Archived", date: `${timeline.archivedDate}T23:59:59.999Z` });
  }
  return points;
}

const KIND_MARKER: Record<TimelinePoint["kind"], string> = {
  created: "▶",
  task: "●",
  archived: "■",
};

export function MultiChangeTimelineView({ timelines, rangeStart, rangeEnd }: MultiChangeTimelineViewProps) {
  const rangeStartMs = new Date(rangeStart).getTime();
  const rangeEndMs = new Date(rangeEnd).getTime();

  return (
    <div className="openspec-multi-timeline" data-testid="multi-change-timeline-view">
      <div className="openspec-multi-timeline-axis">
        <span>{new Date(rangeStart).toLocaleDateString()}</span>
        <span>{new Date(rangeEnd).toLocaleDateString()}</span>
      </div>
      {timelines.length === 0 ? (
        <p>No changes selected.</p>
      ) : (
        timelines.map((timeline) => (
          <div
            className="openspec-multi-timeline-lane"
            key={timeline.changeName}
            data-testid={`multi-timeline-lane-${timeline.changeName}`}
          >
            <span className="openspec-multi-timeline-lane-label">{timeline.changeName}</span>
            <div className="openspec-multi-timeline-track">
              {pointsFor(timeline).map((point, index) => (
                <span
                  key={`${point.kind}-${index}-${point.date}`}
                  className={`openspec-multi-timeline-point openspec-multi-timeline-point-${point.kind}`}
                  style={{ left: `${logPosition(new Date(point.date).getTime(), rangeStartMs, rangeEndMs)}%` }}
                  title={`${point.label} — ${new Date(point.date).toLocaleString()}`}
                >
                  {KIND_MARKER[point.kind]}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
