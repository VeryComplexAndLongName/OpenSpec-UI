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
//
// Where standings have been read, each change shows the one state word core
// gives it, with the lines beneath it, and the list says which main was read
// and when refs were last fetched (a-change-says-where-it-stands).

import { useMemo, useState } from "react";
import type { DescribedChangeState } from "@openspec-ui/core/browser";
import type { ChangeSummary } from "../types.js";
import { STATE_LABEL, filterChanges } from "./change-filter.js";
import { formatTaskProgress } from "./task-progress.js";
import { useVirtualList } from "./use-virtual-list.js";

export interface ChangesListProps {
  changes: ChangeSummary[];
  onSelect?: (name: string) => void;
  /** Each change's state word, lines and colour, as core describes them. A
   * change it has none for shows its derived state as before. */
  states?: ReadonlyMap<string, DescribedChangeState>;
  /** Which main was read, when refs were last fetched, and what could not be
   * read. */
  sources?: string;
  /** Reads the files again and fetches refs now. */
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshError?: string;
}

export function ChangesList({ changes, onSelect, states, sources, onRefresh, refreshing = false, refreshError }: ChangesListProps) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterChanges(changes, query), [changes, query]);
  const { containerRef, containerStyle, listStyle, rows } = useVirtualList(visible, (change) => change.name, {
    itemHeight: 40,
  });

  return (
    <div className="openspec-changes-list-container">
      <div className="openspec-ai-panel-controls">
        <input
          type="search"
          aria-label="Search changes"
          placeholder="Search changes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {onRefresh ? (
          <button type="button" className="button" data-testid="changes-refresh" disabled={refreshing} onClick={onRefresh}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        ) : null}
      </div>
      <div ref={containerRef} style={containerStyle} className="openspec-changes-list-scroll">
        <ul className="openspec-changes-list" data-testid="changes-list" style={listStyle}>
          {rows.map(({ item: change, key, style }) => {
            const standing = states?.get(change.name);
            return (
              <li key={key} style={style}>
                <button
                  type="button"
                  data-testid={`change-${change.name}`}
                  onClick={() => onSelect?.(change.name)}
                >
                  <span className="openspec-change-name">{change.name}</span>
                  {standing ? (
                    // The word is always written; the colour only agrees with it.
                    // A badge is Metro's own (the-web-ui-screens-wear-metro
                    // 3.2); the state's colour token and class stay, so what
                    // reads the class still finds it.
                    <span
                      className={`badge openspec-change-standing openspec-change-standing--${standing.colour}`}
                      data-testid={`change-${change.name}-standing`}
                    >
                      {standing.word}
                    </span>
                  ) : (
                    <span className={`badge openspec-change-state openspec-change-state--${change.state}`}>
                      {STATE_LABEL[change.state]}
                    </span>
                  )}
                  <span className="openspec-change-progress">
                    {formatTaskProgress(change.completedTasks, change.totalTasks)}
                  </span>
                  {standing && standing.lines.length > 0 ? (
                    <span className="openspec-change-standing-lines" data-testid={`change-${change.name}-lines`}>
                      {standing.lines.map((line) => line.text).join(" · ")}
                    </span>
                  ) : null}
                  {change.lastModified && <time dateTime={change.lastModified}>{change.lastModified}</time>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {sources ? <p className="openspec-shell-note" data-testid="changes-sources">{sources}</p> : null}
      {refreshError ? (
        <p className="openspec-shell-error" role="alert" data-testid="changes-refresh-error">{`Refresh failed: ${refreshError}`}</p>
      ) : null}
    </div>
  );
}
