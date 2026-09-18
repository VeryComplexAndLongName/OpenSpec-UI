// What a reader can find, and what a finished branch of the declared order
// looks like (the-views-are-searched-and-landed-relations-fold).
//
// Both halves are here because both are answers a product gives, not
// markup: whether a word finds a change decides what a person sees, and
// two copies of that rule in two hosts are two answers to one question.
// The standalone lists had the only copy, in webui, and the editor's views
// had none at all.
//
// Pure, and a leaf: no filesystem, no git, so the browser and the extension
// host share it.

import type { ChangeGraph } from "./change-graph.js";

/** Whether a row matches what was typed.
 *
 * Every whitespace-separated word of the query must appear, case
 * insensitively, in at least one field. Words rather than one substring:
 * a reader types part of a name and part of a state in the same breath,
 * and "blocked pipeline" should find the blocked pipeline change rather
 * than nothing. An empty query matches everything, which is what an empty
 * search box means.
 *
 * Fields that are absent are skipped, so a caller can pass what a row has
 * without building a string first. */
export function matchesFilter(query: string, fields: ReadonlyArray<string | undefined>): boolean {
  const words = query.trim().toLowerCase().split(/\s+/u).filter((word) => word.length > 0);
  if (words.length === 0) return true;
  const haystack = fields.filter((field): field is string => field !== undefined).map((field) => field.toLowerCase());
  return words.every((word) => haystack.some((field) => field.includes(word)));
}

/** A root of the `follows` relation, what hangs under it, and whether the
 * whole of it has landed. */
export interface GraphBranch {
  /** The change no change in this branch follows. */
  root: string;
  /** Every change reachable from the root through `follows`, the root
   * included. */
  members: string[];
  /** Every one of them is archived. */
  landed: boolean;
}

/** The branches of a change graph, by their roots.
 *
 * A branch is landed only where the root and every change under it are
 * archived: a branch holding one change that is still active is where the
 * work is, however much of the rest is finished. The Change Graph folds
 * the landed ones away and says how many, which is what was asked for
 * after two finished clusters stayed in the way of the part being decided
 * (DW, 2026-09-18).
 *
 * A cycle cannot loop this: a change already counted is not walked again. */
export function landedBranches(graph: ChangeGraph): GraphBranch[] {
  const children = new Map<string, string[]>();
  for (const node of graph.values()) {
    for (const parent of node.follows) {
      const existing = children.get(parent);
      if (existing) existing.push(node.id);
      else children.set(parent, [node.id]);
    }
  }

  const branches: GraphBranch[] = [];
  for (const node of [...graph.values()].sort((left, right) => left.id.localeCompare(right.id))) {
    if (node.follows.length > 0) continue;
    const members: string[] = [];
    const seen = new Set<string>();
    const queue = [node.id];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      if (graph.has(id)) members.push(id);
      queue.push(...(children.get(id) ?? []));
    }
    branches.push({
      root: node.id,
      members,
      landed: members.every((id) => graph.get(id)?.archived === true),
    });
  }
  return branches;
}

/** The roots whose whole branch has landed, for a view that folds them. */
export function landedRoots(graph: ChangeGraph): Set<string> {
  return new Set(landedBranches(graph).filter((branch) => branch.landed).map((branch) => branch.root));
}
