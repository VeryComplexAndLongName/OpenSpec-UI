// 2.3 Archive: search, filters, history. Accepts a list already filtered
// by `state === "archived"` (the host decides what counts as the archive)
// — the component filters by name or status label (via the shared
// `filterChanges`, also used by `ChangesList`), sorts by date (history),
// formats task progress via the same shared helper `ChangesList` uses
// (see openspec/changes/change-progress-display/proposal.md), and
// renders windowed above a size threshold, inside an always-bounded
// scroll container, via the same shared hook `ChangesList` uses (see
// openspec/changes/virtualize-change-lists/design.md).

import { useMemo, useState } from "react";
import type { ChangeSummary } from "../types.js";
import { filterChanges } from "./change-filter.js";
import { formatTaskProgress } from "./task-progress.js";
import { useVirtualList } from "./use-virtual-list.js";

export interface ArchiveListProps {
  changes: ChangeSummary[];
  onSelect?: (name: string) => void;
}

export function ArchiveList({ changes, onSelect }: ArchiveListProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const filtered = filterChanges(changes, query);
    return [...filtered].sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""));
  }, [changes, query]);

  const { containerRef, containerStyle, listStyle, rows } = useVirtualList(visible, (change) => change.name, {
    itemHeight: 40,
  });

  return (
    <div className="openspec-archive-list">
      <input
        type="search"
        aria-label="Search archive"
        placeholder="Search archived changes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div ref={containerRef} style={containerStyle} className="openspec-archive-list-scroll">
        <ul data-testid="archive-list" style={listStyle}>
          {rows.map(({ item: change, key, style }) => (
            <li key={key} style={style}>
              <button type="button" data-testid={`archive-${change.name}`} onClick={() => onSelect?.(change.name)}>
                <span>{change.name}</span>
                <span className="openspec-change-progress">
                  {formatTaskProgress(change.completedTasks, change.totalTasks)}
                </span>
                {change.lastModified && <time dateTime={change.lastModified}>{change.lastModified}</time>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
