// 2.3 Archive: search, filters, history. Accepts a list already filtered
// by `state === "archived"` (the host decides what counts as the archive)
// — the component filters by name or status label (via the shared
// `filterChanges`, also used by `ChangesList`), sorts by date (history),
// and renders windowed above a size threshold, inside an always-bounded
// scroll container, via the same shared hook `ChangesList` uses (see
// openspec/changes/virtualize-change-lists/design.md).
//
// Drawn with the columns of ADR 0033's mockup (the-summary-looks-like-the-
// mockup): the change, its tasks and the day, in rows with no browser button
// fill. It is the full list the "Recently archived" panel opens to, and draws
// its tasks as that panel does — "done / total", with no bar: the panel is
// half the page wide, and a bar there ran into the day beside it.

import { useMemo, useState } from "react";
import type { ChangeSummary } from "../types.js";
import { formatDay } from "../summary-figures.js";
import { filterChanges } from "./change-filter.js";
import { SearchField } from "./SearchField.js";
import { useVirtualList } from "./use-virtual-list.js";

/** The day a change was archived: the date its archive folder's name begins
 * with, or its last modification where the name carries none. */
function archivedOn(change: ChangeSummary): string {
  return /^(\d{4}-\d{2}-\d{2})-/u.exec(change.name)?.[1] ?? change.lastModified ?? "";
}

/** The name as the panel writes it: the day is its own column, so the date
 * prefix is not repeated. The whole name stays in the row's title. */
function titleOf(change: ChangeSummary): string {
  return /^\d{4}-\d{2}-\d{2}-(.+)$/u.exec(change.name)?.[1] ?? change.name;
}

export interface ArchiveListProps {
  changes: ChangeSummary[];
  onSelect?: (name: string) => void;
}

export function ArchiveList({ changes, onSelect }: ArchiveListProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const filtered = filterChanges(changes, query);
    return [...filtered].sort((a, b) => archivedOn(b).localeCompare(archivedOn(a)));
  }, [changes, query]);

  const { containerRef, containerStyle, listStyle, rows } = useVirtualList(visible, (change) => change.name, {
    itemHeight: 44,
  });

  return (
    <div className="openspec-archive-list">
      <div className="openspec-archive-list-search">
        <SearchField label="Search archive" placeholder="Search archived changes" value={query} onChange={setQuery} />
      </div>
      <div className="openspec-rows-head openspec-archive-columns" aria-hidden="true">
        <span>Change</span>
        <span className="openspec-row-end">Tasks</span>
        <span className="openspec-row-end">Archived</span>
      </div>
      <div ref={containerRef} style={containerStyle} className="openspec-archive-list-scroll">
        <ul className="openspec-rows" data-testid="archive-list" style={listStyle}>
          {rows.map(({ item: change, key, style }) => {
            const day = archivedOn(change);
            return (
              <li key={key} style={style}>
                <button type="button" className="openspec-row openspec-archive-columns" data-testid={`archive-${change.name}`} onClick={() => onSelect?.(change.name)}>
                  <span className="openspec-row-name"><span title={change.name}>{titleOf(change)}</span></span>
                  <span className="openspec-row-end openspec-change-progress">{`${change.completedTasks} / ${change.totalTasks}`}</span>
                  <span className="openspec-row-end openspec-row-day">
                    {day ? <time dateTime={day} title={change.lastModified ?? day}>{formatDay(day)}</time> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
