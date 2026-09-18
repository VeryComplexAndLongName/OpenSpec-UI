// Every change of a workspace on one grid of days, as ADR 0033's mockup
// draws it (the-timeline-compares-changes): a column naming the change, a
// column per day with the weekends shaded, a bar from when each change was
// proposed to when it was archived, and a dashed line at now.
//
// Presentational and transport-agnostic, like its neighbours: the host
// reads the spans, derives the window and the rows with core's
// `change-comparison.ts`, and passes them in. Nothing here measures an
// element — every position is a percentage core computed (ADR 0025).

import {
  COMPARISON_PERIODS,
  labelSide,
  nowOffset,
  type ComparisonPeriodId,
  type ComparisonRow,
  type ComparisonWindow,
} from "@openspec-ui/core/browser";
import type { ReactNode } from "react";
import type { ChangeTimeline } from "../change-timeline-client.js";
import { ChangeChartsView } from "./ChangeChartsView.js";

export interface ChangeComparisonViewProps {
  /** The days drawn, from core's `comparisonWindow`. */
  window: ComparisonWindow;
  /** The rows drawn, from core's `comparisonRows` — already narrowed by
   * the filter. */
  rows: readonly ComparisonRow[];
  /** How many rows there are before the filter, for "3 of 25 match". */
  total: number;
  period: ComparisonPeriodId;
  onPeriod: (period: ComparisonPeriodId) => void;
  filter: string;
  onFilter: (filter: string) => void;
  /** The instant the dashed line marks, as the host read it. */
  now: number;
  /** Opens that change's own timeline. */
  onOpen: (changeName: string, archived: boolean) => void;
  /** The histories behind the charts, as far as the host has read them. */
  timelines?: readonly ChangeTimeline[];
  /** Said under the grid while they are still being read. */
  readingCharts?: string | null;
  /** Said instead where the host could not read them. */
  chartsError?: string | null;
  /** Controls the host puts at the head of this screen's toolbar — the
   * standalone shell's three Timeline modes, which the artboard draws in
   * the same row. The editor's panel has none. */
  leading?: ReactNode;
}

function SearchGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function Row({ row, onOpen }: { row: ComparisonRow; onOpen: ChangeComparisonViewProps["onOpen"] }) {
  const side = labelSide(row);
  return (
    <button
      type="button"
      className="openspec-comparison-row"
      data-testid={`comparison-row-${row.changeName}`}
      data-active={row.active ? "true" : "false"}
      aria-label={row.description}
      onClick={() => onOpen(row.changeName, !row.active)}
    >
      <span className="openspec-comparison-row-name">{row.name}</span>
      {/* The picture repeats what the button's own name already says, so
          nothing here is read twice by a screen reader. */}
      <span className="openspec-comparison-track" aria-hidden="true">
        {row.bar ? (
          <span
            className="openspec-comparison-bar"
            data-clipped-start={row.bar.clippedStart ? "true" : undefined}
            data-clipped-end={row.bar.clippedEnd ? "true" : undefined}
            data-testid={`comparison-bar-${row.changeName}`}
            style={{ "--from": `${row.bar.from}%`, "--to": `${row.bar.to}%` } as React.CSSProperties}
          />
        ) : (
          <span className="openspec-comparison-undated">no dates</span>
        )}
        {row.bar ? (
          <span
            className="openspec-comparison-label"
            data-side={side}
            style={{ "--from": `${row.bar.from}%`, "--to": `${row.bar.to}%` } as React.CSSProperties}
          >
            {row.label}
          </span>
        ) : (
          <span className="openspec-comparison-label" data-side="after" style={{ "--from": "0%", "--to": "0%" } as React.CSSProperties}>
            {row.label}
          </span>
        )}
      </span>
    </button>
  );
}

export function ChangeComparisonView({
  window,
  rows,
  total,
  period,
  onPeriod,
  filter,
  onFilter,
  now,
  onOpen,
  timelines,
  readingCharts = null,
  chartsError = null,
  leading = null,
}: ChangeComparisonViewProps) {
  const at = nowOffset(window, now);

  return (
    <div className="openspec-comparison" data-testid="change-comparison-view">
      <div className="openspec-controls openspec-comparison-toolbar" data-testid="comparison-toolbar">
        {leading}
        <div className="openspec-segmented" role="group" aria-label="Period">
          {COMPARISON_PERIODS.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={period === choice.id}
              onClick={() => onPeriod(choice.id)}
            >
              {choice.label}
            </button>
          ))}
        </div>

        <label className="openspec-comparison-filter">
          <SearchGlyph />
          <input
            type="search"
            aria-label="Filter changes"
            placeholder="Filter changes"
            value={filter}
            onChange={(event) => onFilter(event.target.value)}
            data-testid="comparison-filter"
          />
        </label>
        {filter.trim().length > 0 ? (
          <span className="openspec-shell-note" data-testid="comparison-filter-count">
            {`${rows.length} of ${total} match`}
          </span>
        ) : null}

        <ul className="openspec-comparison-legend" data-testid="comparison-legend">
          <li><span className="openspec-comparison-swatch openspec-comparison-swatch--archived" aria-hidden="true" />Archived</li>
          <li><span className="openspec-comparison-swatch openspec-comparison-swatch--active" aria-hidden="true" />Active</li>
        </ul>
      </div>

      <section className="openspec-panel openspec-comparison-panel">
        <div
          className="openspec-comparison-scroll"
          role="region"
          tabIndex={0}
          aria-label="Changes over days, scrolls sideways"
        >
          <div
            className="openspec-comparison-grid"
            style={{
              "--days": window.days.length,
              // The width core derived for one day: it is what decides
              // which of its names fits (ADR 0025).
              "--comparison-day": `${window.dayRem}rem`,
            } as React.CSSProperties}
          >
            <div className="openspec-comparison-head">
              <span className="openspec-comparison-name-head">Change</span>
              <span className="openspec-comparison-days">
                {window.days.map((day) => (
                  <span
                    key={day.day}
                    className="openspec-comparison-day"
                    data-weekend={day.weekend ? "true" : undefined}
                    data-testid={`comparison-day-${day.day}`}
                    title={day.heading}
                  >
                    {day.label}
                  </span>
                ))}
              </span>
            </div>

            <div className="openspec-comparison-rows">
              {/* The shading and the line sit behind the rows rather than
                  in each of them: they belong to the grid, not to a change. */}
              <span className="openspec-comparison-bands" aria-hidden="true">
                {window.days.map((day) => (
                  <span key={day.day} className="openspec-comparison-band" data-weekend={day.weekend ? "true" : undefined} />
                ))}
                {at === null ? null : (
                  <span
                    className="openspec-comparison-now"
                    data-testid="comparison-now"
                    style={{ "--at": `${at}%` } as React.CSSProperties}
                  />
                )}
              </span>
              {rows.length === 0 ? (
                <p className="openspec-panel-empty" data-testid="comparison-empty">
                  {total === 0 ? "No change of this workspace falls in these days." : "No change matches that name."}
                </p>
              ) : (
                rows.map((row) => <Row key={row.changeName} row={row} onOpen={onOpen} />)
              )}
            </div>
          </div>
        </div>
        <p className="openspec-panel-fine" data-testid="comparison-footnote">
          The dashed line is now. Sat and Sun are shaded. Click a row to open that change&apos;s own timeline.
        </p>
      </section>

      {chartsError ? (
        <p className="openspec-shell-note" data-testid="comparison-charts-error">{chartsError}</p>
      ) : readingCharts ? (
        <p className="openspec-shell-note" data-testid="comparison-charts-reading">{readingCharts}</p>
      ) : null}
      {timelines && timelines.length > 0 ? <ChangeChartsView timelines={[...timelines]} /> : null}
    </div>
  );
}
