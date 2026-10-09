// The chain of changes one change grew out of. Browser-safe: it walks a graph
// read elsewhere, so the editor and the standalone app say the same chain
// (a-change-is-acted-on-from-its-card).

import type { ChangeGraph, ChangeGraphNode } from "./change-graph.js";

/** The chain of changes one change grew out of, breadth-first so the
 * nearest reason comes first. Answers the question the graph exists for -
 * why is this here - from the change rather than from the graph. */
export function changeAncestry(nodes: ChangeGraph, id: string): ChangeGraphNode[] {
  const start = nodes.get(id);
  if (!start) return [];

  const seen = new Set<string>([id]);
  const ordered: ChangeGraphNode[] = [];
  let frontier = [...start.follows];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const current of frontier) {
      if (seen.has(current)) continue;
      seen.add(current);
      const node = nodes.get(current);
      if (!node) continue;
      ordered.push(node);
      next.push(...node.follows);
    }
    frontier = next;
  }
  return ordered;
}
