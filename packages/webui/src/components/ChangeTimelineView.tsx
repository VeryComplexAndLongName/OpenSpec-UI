// 2.1 Presentational, transport-agnostic (props only) — the host fetches
// a `ChangeTimeline` and passes it in; this component never calls a
// transport/client itself (same convention as ArchiveList/ChangesList).
// See openspec/changes/add-change-timeline-view/design.md.

import { useState } from "react";
import { renderMarkdown } from "../markdown.js";
import type { ChangeTimeline, ChangeTimelineTask } from "../change-timeline-client.js";

export interface ChangeTimelineViewProps {
  timeline: ChangeTimeline;
}

function formatDate(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleString();
}

/** Checked tasks with a known date first (oldest to newest); checked
 * tasks with no determinable date, then still-pending tasks, at the
 * end — original tasks.md order preserved within each group. */
function sortedTasks(tasks: ChangeTimelineTask[]): ChangeTimelineTask[] {
  return [...tasks].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.lineNumber - b.lineNumber;
  });
}

function TaskRow({ task }: { task: ChangeTimelineTask }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="openspec-timeline-task" data-testid={`timeline-task-${task.lineNumber}`}>
      <button
        type="button"
        className="openspec-timeline-task-toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="openspec-timeline-task-marker" aria-hidden="true">
          {task.date ? "●" : task.done ? "○" : "◌"}
        </span>
        {task.date ? (
          <time className="openspec-timeline-task-date" dateTime={task.date}>{formatDate(task.date)}</time>
        ) : (
          <span className="openspec-timeline-task-date openspec-timeline-task-pending">
            {task.done ? "done, date unknown" : "pending"}
          </span>
        )}
        <span className="openspec-timeline-task-text">{task.text}</span>
      </button>
      {expanded && <p className="openspec-timeline-task-detail">{task.text}</p>}
    </li>
  );
}

export function ChangeTimelineView({ timeline }: ChangeTimelineViewProps) {
  return (
    <div className="openspec-change-timeline" data-testid="change-timeline-view">
      <header className="openspec-timeline-header">
        <h2>{timeline.changeName}</h2>
        <dl>
          <dt>Created</dt>
          <dd>{timeline.createdDate ? formatDate(timeline.createdDate) : "unknown"}</dd>
          {timeline.archived && (
            <>
              <dt>Archived</dt>
              <dd>{timeline.archivedDate ?? "unknown"}</dd>
            </>
          )}
        </dl>
      </header>

      {timeline.proposal.trim().length > 0 && (
        <section className="openspec-timeline-artifact">
          <h3>Proposal</h3>
          {renderMarkdown(timeline.proposal)}
        </section>
      )}

      {timeline.design.trim().length > 0 && (
        <section className="openspec-timeline-artifact">
          <h3>Design</h3>
          {renderMarkdown(timeline.design)}
        </section>
      )}

      {timeline.specs.map((spec) => (
        <section className="openspec-timeline-artifact" key={spec.specId}>
          <h3>Spec: {spec.specId}</h3>
          {renderMarkdown(spec.content)}
        </section>
      ))}

      <section className="openspec-timeline-tasks">
        <h3>Tasks</h3>
        {timeline.tasks.length === 0 ? (
          <p>No tasks found.</p>
        ) : (
          <ul data-testid="change-timeline-tasks">
            {sortedTasks(timeline.tasks).map((task) => (
              <TaskRow key={task.lineNumber} task={task} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
