// 3.3 Search over specs — client-side, matching spec id and requirement text.

import { useMemo, useState } from "react";
import type { SpecSummary } from "./SpecsTree.js";

export interface SpecsSearchResult {
  specId: string;
  requirementIndex: number;
  snippet: string;
}

export function searchSpecs(specs: SpecSummary[], query: string): SpecsSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const results: SpecsSearchResult[] = [];
  for (const spec of specs) {
    spec.requirements.forEach((requirement, index) => {
      if (spec.id.toLowerCase().includes(q) || requirement.text.toLowerCase().includes(q)) {
        results.push({
          specId: spec.id,
          requirementIndex: index,
          snippet: requirement.text.length > 100 ? `${requirement.text.slice(0, 100)}…` : requirement.text,
        });
      }
    });
  }
  return results;
}

export interface SpecsSearchProps {
  specs: SpecSummary[];
  onSelect?: (specId: string, requirementIndex: number) => void;
}

export function SpecsSearch({ specs, onSelect }: SpecsSearchProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSpecs(specs, query), [specs, query]);

  return (
    <div className="openspec-specs-search">
      <input
        type="search"
        aria-label="Search specs"
        placeholder="Search specs…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul data-testid="specs-search-results">
        {results.map((result) => (
          <li key={`${result.specId}-${result.requirementIndex}`}>
            <button
              type="button"
              data-testid={`result-${result.specId}-${result.requirementIndex}`}
              onClick={() => onSelect?.(result.specId, result.requirementIndex)}
            >
              <strong>{result.specId}</strong>: {result.snippet}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
