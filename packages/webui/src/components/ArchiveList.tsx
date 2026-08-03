// 2.3 Archive: поиск, фильтры, история. Принимает уже отфильтрованный по
// `state === "archived"` список (хост решает, что считать архивом) —
// компонент добавляет только клиентский текстовый поиск и сортировку по
// дате (история).

import { useMemo, useState } from "react";
import type { ChangeSummary } from "../types.js";

export interface ArchiveListProps {
  changes: ChangeSummary[];
  onSelect?: (name: string) => void;
}

export function ArchiveList({ changes, onSelect }: ArchiveListProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const filtered = query.trim().length === 0
      ? changes
      : changes.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));
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
