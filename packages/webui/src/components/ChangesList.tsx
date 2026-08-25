// 2.1 List of Changes — status comes from `ChangeSummary.state`, computed
// by `execution-core` (see spec.md, "A change's status is displayed from
// derived state, not recomputed in the UI").

import type { ChangeSummary } from "../types.js";

const STATE_LABEL: Record<ChangeSummary["state"], string> = {
  draft: "Draft",
  "in-progress": "In progress",
  implemented: "Implemented",
  archived: "Archived",
};

export interface ChangesListProps {
  changes: ChangeSummary[];
  onSelect?: (name: string) => void;
}

export function ChangesList({ changes, onSelect }: ChangesListProps) {
  return (
    <ul className="openspec-changes-list" data-testid="changes-list">
      {changes.map((change) => (
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
              {change.completedTasks}/{change.totalTasks}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
