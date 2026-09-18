// Shared filter predicate for ChangesList/ArchiveList (see
// openspec/changes/changes-overview-search/design.md, "Filter predicate
// extracted to a shared, pure function") — one implementation, not two
// independently-maintained copies.

import { matchesFilter } from "@openspec-ui/core/browser";
import type { ChangeSummary } from "../types.js";

export const STATE_LABEL: Record<ChangeSummary["state"], string> = {
  draft: "Draft",
  "in-progress": "In progress",
  implemented: "Implemented",
  archived: "Archived",
};

export function filterChanges(changes: ChangeSummary[], query: string): ChangeSummary[] {
  // The rule is core's, so a word that finds a change here finds it in the
  // editor's views too (the-views-are-searched-and-landed-relations-fold).
  return changes.filter((change) => matchesFilter(query, [change.name, STATE_LABEL[change.state]]));
}
