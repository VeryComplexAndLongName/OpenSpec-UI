// 2.1 List of Changes — status comes from `ChangeSummary.state`, computed
// by `execution-core` (see spec.md, "A change's status is displayed from
// derived state, not recomputed in the UI"). Search filters by name or
// status label via the same shared predicate `ArchiveList` uses (see
// openspec/changes/changes-overview-search/design.md). Task progress is
// formatted via the same shared helper `ArchiveList` uses (see
// openspec/changes/change-progress-display/proposal.md).

import { useMemo, useState } from "react";
import type { ChangeSummary } from "../types.js";
import { STATE_LABEL, filterChanges } from "./change-filter.js";
import { formatTaskProgress } from "./task-progress.js";

export interface ChangesListProps {
  changes: ChangeSummary[];
  onSelect?: (name: string) => void;
}

export function ChangesList({ changes, onSelect }: ChangesListProps) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterChanges(changes, query), [changes, query]);

  return (
    <div className="openspec-changes-list-container">
      <input
        type="search"
        aria-label="Search changes"
        placeholder="Search changes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="openspec-changes-list" data-testid="changes-list">
        {visible.map((change) => (
          <li key={change.name}>
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
  );
}
