// 2.1 List of Changes — status comes from `ChangeSummary.state`, computed
// by `execution-core` (see spec.md, "A change's status is displayed from
// derived state, not recomputed in the UI"). Search filters by name or
// status label via the same shared predicate `ArchiveList` uses (see
// openspec/changes/changes-overview-search/design.md). Rendering is
// windowed above a size threshold, inside an always-bounded scroll
// container, via the same shared hook `ArchiveList` uses (see
// openspec/changes/virtualize-change-lists/design.md).
//
// Where standings have been read, each change shows the one state word core
// gives it, with the lines beneath it, and the list says which main was read
// and when refs were last fetched (a-change-says-where-it-stands).
//
// Drawn as the "Changes" panel of ADR 0033's mockup
// (the-summary-looks-like-the-mockup): the search in the panel's head, a
// column header, and each row a button laid out as name, state badge,
// progress and day. The row keeps no browser button fill; the grey plates the
// owner saw were exactly that.

import { useMemo, useState, type ReactNode } from "react";
import { describeOwnership, isOursToWrite, type ChangeOwnership, type DescribedChangeState } from "@openspec-ui/core/browser";
import type { ChangeSummary } from "../types.js";
import { formatDay } from "../summary-figures.js";
import { STATE_LABEL, filterChanges } from "./change-filter.js";
import { ProgressCell } from "./ProgressCell.js";
import { SearchField } from "./SearchField.js";
import { useVirtualList } from "./use-virtual-list.js";

export interface ChangesListProps {
  changes: ChangeSummary[];
  onSelect?: (name: string) => void;
  /** Each change's state word, lines and colour, as core describes them. A
   * change it has none for shows its derived state as before. */
  states?: ReadonlyMap<string, DescribedChangeState>;
  /** Whose each change is, as core reads it from the survey. A change it
   * has no answer for is drawn as before
   * (changes-shows-one-change-and-who-owns-it). */
  ownerships?: ReadonlyMap<string, ChangeOwnership>;
  /** Which main was read, when refs were last fetched, and what could not be
   * read. */
  sources?: string;
  /** Reads the files again and fetches refs now. */
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshError?: string;
  /** A line for the panel's foot, such as where the workspace was read. */
  footnote?: ReactNode;
}

/** A row's height: one line, or the name with a standing's lines under it. */
const ROW_HEIGHT = 44;
const ROW_HEIGHT_WITH_LINES = 60;

export function ChangesList({ changes, onSelect, states, ownerships, sources, onRefresh, refreshing = false, refreshError, footnote }: ChangesListProps) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterChanges(changes, query), [changes, query]);
  const withLines = [...(states?.values() ?? [])].some((standing) => standing.lines.length > 0)
    || [...(ownerships?.values() ?? [])].some((ownership) => describeOwnership(ownership) !== undefined);
  const { containerRef, containerStyle, listStyle, rows } = useVirtualList(visible, (change) => change.name, {
    itemHeight: withLines ? ROW_HEIGHT_WITH_LINES : ROW_HEIGHT,
  });

  return (
    <section className="openspec-panel openspec-changes-list-container" data-testid="summary-changes">
      <div className="openspec-panel-head">
        <h2>Changes</h2>
        <SearchField label="Search changes" placeholder="Search by name or status" value={query} onChange={setQuery} />
      </div>
      <div className="openspec-rows-head openspec-change-columns" aria-hidden="true">
        <span>Name</span>
        <span>State</span>
        <span>Tasks</span>
        <span className="openspec-row-end">Updated</span>
      </div>
      <div ref={containerRef} style={containerStyle} className="openspec-changes-list-scroll">
        <ul className="openspec-changes-list openspec-rows" data-testid="changes-list" style={listStyle}>
          {rows.map(({ item: change, key, style }) => {
            const standing = states?.get(change.name);
            // Whose it is, where the survey has been read. A change worked
            // in another working directory is drawn apart from this
            // directory's own: it is not this window's to act on.
            const ownership = ownerships?.get(change.name);
            const whose = ownership === undefined ? undefined : describeOwnership(ownership);
            const theirs = ownership !== undefined && !isOursToWrite(ownership);
            return (
              <li key={key} style={style} className={withLines ? "openspec-row--tall" : undefined}>
                <button
                  type="button"
                  className={`openspec-row openspec-change-columns${theirs ? " openspec-change-row--elsewhere" : ""}`}
                  data-testid={`change-${change.name}`}
                  {...(whose ? { title: whose } : {})}
                  onClick={() => onSelect?.(change.name)}
                >
                  <span className="openspec-row-name">
                    <span className="openspec-change-name">{change.name}</span>
                    {standing && standing.lines.length > 0 ? (
                      <span className="openspec-change-standing-lines" data-testid={`change-${change.name}-lines`}>
                        {standing.lines.map((line) => line.text).join(" · ")}
                      </span>
                    ) : null}
                    {whose ? (
                      <span className="openspec-change-worked-in" data-testid={`change-${change.name}-worked`}>
                        {whose}
                      </span>
                    ) : null}
                  </span>
                  <span className="openspec-row-state">
                    {standing ? (
                      // The word is always written; the colour only agrees with it.
                      <span
                        className={`badge openspec-change-standing openspec-change-standing--${standing.colour}`}
                        data-testid={`change-${change.name}-standing`}
                        title={standing.word}
                      >
                        {standing.word}
                      </span>
                    ) : (
                      <span className={`badge openspec-change-state openspec-change-state--${change.state}`}>
                        {STATE_LABEL[change.state]}
                      </span>
                    )}
                  </span>
                  <ProgressCell completedTasks={change.completedTasks} totalTasks={change.totalTasks} />
                  <span className="openspec-row-end openspec-row-day">
                    {change.lastModified
                      ? <time dateTime={change.lastModified} title={change.lastModified}>{formatDay(change.lastModified)}</time>
                      : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {sources || footnote || onRefresh ? (
        <div className="openspec-panel-fine openspec-panel-foot">
          <span>
            {sources ? <span data-testid="changes-sources">{sources}</span> : null}
            {sources && footnote ? " " : null}
            {footnote}
          </span>
          {onRefresh ? (
            <button type="button" className="button openspec-button-quiet openspec-button-small" data-testid="changes-refresh" disabled={refreshing} onClick={onRefresh}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          ) : null}
        </div>
      ) : null}
      {refreshError ? (
        <p className="openspec-shell-error" role="alert" data-testid="changes-refresh-error">{`Refresh failed: ${refreshError}`}</p>
      ) : null}
    </section>
  );
}
