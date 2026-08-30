// Shared filter predicate for ChangesList/ArchiveList (see
// openspec/changes/changes-overview-search/design.md, "Filter predicate
// extracted to a shared, pure function") — one implementation, not two
// independently-maintained copies.

import type { ChangeSummary } from "../types.js";

export const STATE_LABEL: Record<ChangeSummary["state"], string> = {
  draft: "Draft",
  "in-progress": "In progress",
  implemented: "Implemented",
  archived: "Archived",
};

export function filterChanges(changes: ChangeSummary[], query: string): ChangeSummary[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return changes;
  return changes.filter(
    (change) => change.name.toLowerCase().includes(q) || STATE_LABEL[change.state].toLowerCase().includes(q),
  );
}
