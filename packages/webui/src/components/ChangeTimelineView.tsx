// One change's history, as ADR 0033's mockup draws it
// (the-change-timeline-looks-like-the-mockup): the moments git gives a time
// on a rail, a Tasks tile and the dates with their sources beside it, and
// below them whatever the rail cannot place.
//
// Presentational, transport-agnostic (props only): the host fetches a
// `ChangeTimeline` and passes it in, and `timeline-moments.ts` derives what
// is drawn. See openspec/changes/add-change-timeline-view/design.md.

import { useState } from "react";
import { DEFAULT_STALE_TASK_THRESHOLD_DAYS, withoutArchivePrefix } from "@openspec-ui/core/browser";
import { renderMarkdown } from "../markdown.js";
import type { ChangeTimeline, ChangeTimelineTask } from "../change-timeline-client.js";
import {
  formatMoment,
  formatMomentDay,
  openTasks,
  taskNumberAndTitle,
  taskSentence,
  timelineDates,
  timelineMoments,
  timelineTile,
  undatedDoneTasks,
  type TimelineMoment,
} from "../timeline-moments.js";
import { Icon } from "./Icon.js";

export interface ChangeTimelineViewProps {
  timeline: ChangeTimeline;
  /** Days a pending task can sit untouched before it's flagged stale.
   * Defaults to `DEFAULT_STALE_TASK_THRESHOLD_DAYS` (14). */
  staleThresholdDays?: number;
  /** Injectable for deterministic tests — defaults to the real current
   * time. */
  now?: Date;
  /** The zone times are read in; the viewer's own when absent. For tests. */
  timeZone?: string;
  /** Draws the change's name above the view, for a host with no page head
   * of its own to carry it: the editor's panel. */
  heading?: boolean;
}

/** How many tasks of a moment are listed before "and N more". */
const TASKS_SHOWN = 3;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className="openspec-change-timeline-chevron" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TaskLine({ task }: { task: ChangeTimelineTask }) {
  const { number, title } = taskNumberAndTitle(taskSentence(task));
  return (
    <span className="openspec-change-timeline-task" data-testid={`timeline-task-${task.lineNumber}`}>
      {number ? <span className="openspec-change-timeline-number">{number}</span> : null}
      {/* One line, as the mockup draws a task; the whole sentence on hover. */}
      <span className="openspec-change-timeline-title" title={title}>{title}</span>
    </span>
  );
}

function TaskGroup({ tasks, index }: { tasks: ChangeTimelineTask[]; index: number }) {
  const [open, setOpen] = useState(true);
  const [whole, setWhole] = useState(false);
  const shown = whole ? tasks : tasks.slice(0, TASKS_SHOWN);
  const listId = `change-timeline-group-${index}`;
  return (
    <>
      <button
        type="button"
        className="openspec-change-timeline-group-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        data-testid={`timeline-group-toggle-${index}`}
      >
        {`${tasks.length} tasks ticked in one commit`}
        <Chevron open={open} />
      </button>
      {open ? (
        <ul className="openspec-change-timeline-group" id={listId} data-testid={`timeline-group-${index}`}>
          {shown.map((task) => <li key={task.lineNumber}><TaskLine task={task} /></li>)}
          {tasks.length > shown.length ? (
            <li>
              <button type="button" className="openspec-link-button" onClick={() => setWhole(true)} data-testid={`timeline-group-more-${index}`}>
                {`and ${tasks.length - shown.length} more`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </>
  );
}

function Moment({ moment, index, timeZone }: { moment: TimelineMoment; index: number; timeZone?: string }) {
  const when = moment.kind === "archived" && moment.day !== undefined ? formatMomentDay(moment.day) : formatMoment(moment.at, timeZone);
  return (
    <li className={`openspec-change-timeline-moment openspec-change-timeline-moment--${moment.kind}`} data-testid={`timeline-moment-${index}`}>
      <time className="openspec-change-timeline-when" dateTime={moment.kind === "archived" && moment.day !== undefined ? moment.day : moment.at}>{when}</time>
      {moment.kind === "proposed" ? (
        <span className="openspec-change-timeline-what">
          <span className="badge openspec-change-timeline-badge openspec-change-timeline-badge--proposed">Proposed</span>
          proposal.md first committed
        </span>
      ) : moment.kind === "archived" ? (
        <span className="openspec-change-timeline-what">
          <span className="badge openspec-change-timeline-badge openspec-change-timeline-badge--archived">Archived</span>
          {`moved to archive/${moment.folder}`}
        </span>
      ) : moment.tasks.length === 1 ? (
        <span className="openspec-change-timeline-what"><TaskLine task={moment.tasks[0] as ChangeTimelineTask} /></span>
      ) : (
        <TaskGroup tasks={moment.tasks} index={index} />
      )}
    </li>
  );
}

export function ChangeTimelineView({
  timeline,
  staleThresholdDays = DEFAULT_STALE_TASK_THRESHOLD_DAYS,
  now = new Date(),
  timeZone,
  heading = false,
}: ChangeTimelineViewProps) {
  const moments = timelineMoments(timeline);
  const tile = timelineTile(timeline);
  const dates = timelineDates(timeline, timeZone);
  const open = openTasks(timeline, staleThresholdDays, now);
  const undated = undatedDoneTasks(timeline);
  const largestShared = Math.max(0, ...moments.map((moment) => (moment.kind === "tasks" ? moment.tasks.length : 0)));
  const documents = [
    ...(timeline.proposal.trim().length > 0 ? [{ key: "proposal", title: "Proposal", content: timeline.proposal }] : []),
    ...(timeline.design.trim().length > 0 ? [{ key: "design", title: "Design", content: timeline.design }] : []),
    ...timeline.specs.map((spec) => ({ key: `spec-${spec.specId}`, title: `Spec: ${spec.specId}`, content: spec.content })),
  ];

  return (
    <div className="openspec-change-timeline" data-testid="change-timeline-view">
      {heading ? (
        <header className="openspec-change-timeline-heading" data-testid="change-timeline-heading">
          <h2>{withoutArchivePrefix(timeline.changeName)}</h2>
          <p>{`${timeline.archived ? "Archived" : "Active"} · each task placed when git shows it was ticked`}</p>
        </header>
      ) : null}

      <div className="openspec-change-timeline-columns">
        <section className="openspec-panel" data-testid="change-timeline-moments">
          <div className="openspec-panel-head">
            <h2>Tasks over time</h2>
            <span className="openspec-panel-head-note">times are local</span>
          </div>
          {moments.length === 0 ? (
            <p className="openspec-panel-body openspec-panel-empty">Git gives this change no times yet.</p>
          ) : (
            <ol className="openspec-change-timeline-rail" data-testid="change-timeline-tasks">
              {moments.map((moment, index) => <Moment key={`${moment.kind}-${moment.at}`} moment={moment} index={index} timeZone={timeZone} />)}
            </ol>
          )}
        </section>

        <div className="openspec-change-timeline-side">
          <div
            className={`openspec-tile openspec-change-timeline-tile${tile.total > 0 && tile.done === tile.total ? " openspec-change-timeline-tile--done" : ""}`}
            data-testid="change-timeline-tile"
          >
            <span className="openspec-tile-icon" aria-hidden="true"><Icon meaning="task" /></span>
            <span className="openspec-tile-text">
              <span className="openspec-tile-label">Tasks</span>
              <strong className="openspec-tile-value">{`${tile.done} / ${tile.total}`}</strong>
              {tile.span ? <span className="openspec-tile-note">{tile.span}</span> : null}
            </span>
          </div>

          <section className="openspec-panel" data-testid="change-timeline-dates">
            <div className="openspec-panel-head"><h2>Dates</h2></div>
            <dl className="openspec-change-timeline-dates">
              {dates.map((row) => (
                <div key={row.label} data-testid={`timeline-date-${row.label.toLowerCase().replace(" ", "-")}`}>
                  <dt>{row.label}</dt>
                  <dd>
                    <span className="openspec-change-timeline-date">{row.when ?? "—"}</span>
                    <span className="openspec-change-timeline-source">{row.source}</span>
                  </dd>
                </div>
              ))}
            </dl>
            {largestShared > 1 ? (
              <p className="openspec-panel-fine" data-testid="change-timeline-shared-note">
                {`A task ticked in a squashed commit takes that commit's time, which is why ${largestShared} share one moment.`}
              </p>
            ) : null}
          </section>
        </div>
      </div>

      {open.length > 0 ? (
        <section className="openspec-panel" data-testid="change-timeline-open">
          <div className="openspec-panel-head">
            <h2>Still open</h2>
            <span className="openspec-panel-head-note">{`stale after ${staleThresholdDays} days untouched`}</span>
          </div>
          <ul className="openspec-change-timeline-list">
            {open.map(({ task, stale }) => (
              <li key={task.lineNumber} className={stale ? "openspec-change-timeline-stale" : undefined}>
                <TaskLine task={task} />
                {stale ? <span className="badge openspec-change-timeline-badge openspec-change-timeline-badge--stale">Stale</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {undated.length > 0 ? (
        <section className="openspec-panel" data-testid="change-timeline-undated">
          <div className="openspec-panel-head">
            <h2>Done, date unknown</h2>
            <span className="openspec-panel-head-note">git gives these no time</span>
          </div>
          <ul className="openspec-change-timeline-list">
            {undated.map((task) => <li key={task.lineNumber}><TaskLine task={task} /></li>)}
          </ul>
        </section>
      ) : null}

      {documents.length > 0 ? (
        <section className="openspec-panel" data-testid="change-timeline-documents">
          <div className="openspec-panel-head"><h2>Documents</h2></div>
          {documents.map((document) => (
            <details key={document.key} className="openspec-change-timeline-document" data-testid={`timeline-document-${document.key}`}>
              <summary>{document.title}</summary>
              <div className="openspec-change-timeline-document-body">{renderMarkdown(document.content)}</div>
            </details>
          ))}
        </section>
      ) : null}
    </div>
  );
}
