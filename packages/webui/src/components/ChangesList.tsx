// 2.1 List of Changes — status comes from `ChangeSummary.state`, computed
// by `execution-core` (see spec.md, "A change's status is displayed from
// derived state, not recomputed in the UI"). Search filters by name or
// status label via the same shared predicate `ArchiveList` uses (see
// openspec/changes/changes-overview-search/design.md). Task progress is
// formatted via the same shared helper `ArchiveList` uses (see
// openspec/changes/change-progress-display/proposal.md). Rendering is
// windowed above a size threshold, inside an always-bounded scroll
// container, via the same shared hook `ArchiveList` uses (see
// openspec/changes/virtualize-change-lists/design.md).

import { useMemo, useState } from "react";
import type { ChangeSummary } from "../types.js";
import { STATE_LABEL, filterChanges } from "./change-filter.js";
import { formatTaskProgress } from "./task-progress.js";
import { useVirtualList } from "./use-virtual-list.js";

export interface ChangesListProps {
  changes: ChangeSummary[];
  onSelect?: (name: string) => void;
}

export function ChangesList({ changes, onSelect }: ChangesListProps) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterChanges(changes, query), [changes, query]);
  const { containerRef, containerStyle, listStyle, rows } = useVirtualList(visible, (change) => change.name, {
    itemHeight: 40,
  });

  return (
    <div className="openspec-changes-list-container">
      <input
        type="search"
        aria-label="Search changes"
        placeholder="Search changes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div ref={containerRef} style={containerStyle} className="openspec-changes-list-scroll">
        <ul className="openspec-changes-list" data-testid="changes-list" style={listStyle}>
          {rows.map(({ item: change, key, style }) => (
            <li key={key} style={style}>
              <button
                type="button"
                data-testid={`change-${change.name}`}
                onClick={() => onSelect?.(change.name)}
              >
                <span className="openspec-change-name">{change.name}</span>
                <span className={`openspec-change-state openspec-change-state--${change.state}`}>
                  {STATE_LABEL[change.state]}
                </span>
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
