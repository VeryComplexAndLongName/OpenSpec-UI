// 2.3 Archive: search, filters, history. Accepts a list already filtered
// by `state === "archived"` (the host decides what counts as the archive)
// — the component filters by name or status label (via the shared
// `filterChanges`, also used by `ChangesList`) and sorts by date
// (history).

import { useMemo, useState } from "react";
import type { ChangeSummary } from "../types.js";
import { filterChanges } from "./change-filter.js";

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

  return (
    <div className="openspec-archive-list">
      <input
        type="search"
        aria-label="Search archive"
        placeholder="Search archived changes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul data-testid="archive-list">
        {visible.map((change) => (
          <li key={change.name}>
            <button type="button" data-testid={`archive-${change.name}`} onClick={() => onSelect?.(change.name)}>
              <span>{change.name}</span>
              {change.lastModified && <time dateTime={change.lastModified}>{change.lastModified}</time>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
