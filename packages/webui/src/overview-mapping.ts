// Pure mapping helpers for the standalone Overview tab (see
// openspec/changes/changes-overview-search/design.md, "The CLI's
// free-form status string is validated, not blindly cast"). Kept in a
// separate, side-effect-free module — `standalone-entry.tsx` itself
// renders to `document.getElementById("root")` at import time, which
// makes it unsafe to import directly from a unit test.

import type { ChangeState } from "@openspec-ui/core/browser";
import type { ChangeSummary } from "./types.js";

const KNOWN_CHANGE_STATES: readonly ChangeState[] = ["draft", "in-progress", "implemented", "archived"];

/** Normalizes the `openspec` CLI's free-form `status` string into the
 * `ChangeState` union `ChangesList`/`ArchiveList` render — falls back
 * rather than risking an unstyled/blank state if the CLI's wording ever
 * changes. */
export function toChangeState(status: string): ChangeState {
  if ((KNOWN_CHANGE_STATES as readonly string[]).includes(status)) return status as ChangeState;
  console.warn(`Unrecognized change status "${status}" from the openspec CLI; defaulting to "in-progress".`);
  return "in-progress";
}

export function toChangeSummary(
  item: { name: string; completedTasks: number; totalTasks: number; lastModified?: string },
  state: ChangeState,
): ChangeSummary {
  return {
    name: item.name,
    state,
    completedTasks: item.completedTasks,
    totalTasks: item.totalTasks,
    lastModified: item.lastModified,
  };
}
