// Which rows may offer to take a relation back
// (relations-and-leftovers-explain-themselves).
//
// A context menu has no disabled state: an entry is shown or it is not.
// Remove Relation used to be shown on every active change and, on one that
// stated nothing, opened only to say so.
//
// The fact has to ride the row's `contextValue`. A tree row's menu is
// evaluated against `view` and `viewItem` alone - measured 2026-09-22 in
// VS Code 1.137, where a clause matching `resourceFilename` against a
// context key never matched - so a row that states a relation takes
// `.related` after its usual value, and the clauses that meant the usual
// value match both.

import { readChangeGraph, type ChangeGraph } from "@openspec-ui/core";

/** What a row stating a relation carries after its usual context value. */
export const STATES_RELATION_SUFFIX = ".related";

/** The context values that take the suffix: the rows a relation edit is
 * offered on. A change another working directory holds is not one. */
const RELATION_ROWS = new Set([
  "openspec-ui.activeChange",
  "openspec-ui.graphActiveChange",
  "openspec-ui.unwrittenChange",
]);

/** A row's context value once it is known to state a relation. */
export function statingRelation(contextValue: string | undefined): string | undefined {
  return contextValue !== undefined && RELATION_ROWS.has(contextValue)
    ? `${contextValue}${STATES_RELATION_SUFFIX}`
    : contextValue;
}

/** A row's context value without the suffix, for code that asks what kind
 * of row it is. */
export function withoutRelationMark(contextValue: string): string {
  return contextValue.endsWith(STATES_RELATION_SUFFIX)
    ? contextValue.slice(0, -STATES_RELATION_SUFFIX.length)
    : contextValue;
}

/** The active changes that state at least one relation, sorted. */
export function changesStatingRelations(graph: ChangeGraph): string[] {
  return [...graph.values()]
    .filter((node) => !node.archived)
    .filter((node) => node.follows.length + node.supersedes.length + node.blockedBy.length > 0)
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));
}

/** Reads the active changes' metadata for the ids that state a relation.
 * A reading that fails answers undefined, and the caller keeps the last
 * answer: the command still says when there is nothing to remove. */
export async function readChangesStatingRelations(workspaceRoot: string): Promise<string[] | undefined> {
  try {
    return changesStatingRelations(await readChangeGraph(workspaceRoot, { changes: "active" }));
  } catch {
    return undefined;
  }
}
