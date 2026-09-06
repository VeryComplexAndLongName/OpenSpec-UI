// Renders the relation changes state about each other. The reader itself
// lives in `@openspec-ui/core`, so this is formatting only.
//
// `change-dependency-graph` put this in `scripts/` to avoid a second copy
// of the metadata parser, since `scripts/` run before any build and carry
// no dependencies. `change-graph-in-core` removed that reason by moving
// the reader into core for the extension's sake, so the renderer returns
// here — where it was first proposed, and where it compiles alongside the
// package that already wraps core for terminal use.

import type { ChangeGraph, ChangeGraphNode } from "@openspec-ui/core";
import { findUnmetBlockers } from "@openspec-ui/core";

const UNREACHABLE_HEADING = "Not reachable from any root, which a cycle causes:";

type UnmetIndex = Map<string, string[]>;

function unmetByChange(nodes: ChangeGraph): UnmetIndex {
  const unmet: UnmetIndex = new Map();
  for (const { changeId, blockedBy } of findUnmetBlockers(nodes)) {
    const existing = unmet.get(changeId);
    if (existing) existing.push(blockedBy);
    else unmet.set(changeId, [blockedBy]);
  }
  return unmet;
}

function label(node: ChangeGraphNode, unmet: UnmetIndex): string {
  const parts = [node.id];
  if (node.archived) parts.push("(archived)");
  const waiting = unmet.get(node.id);
  if (waiting?.length) parts.push(`(waiting on ${waiting.join(", ")})`);
  const line = parts.join(" ");
  return node.supersedes.length > 0 ? `${line}  [supersedes ${node.supersedes.join(", ")}]` : line;
}

/** Children keyed by the change they follow. Neither `supersedes` nor
 * `blocked_by` is a parent: the first says this change corrected a
 * decision, the second that it is waiting on one, and threading either
 * into the tree would claim an order the repository never stated. Both
 * are shown as annotations instead. */
function childrenByParent(nodes: ChangeGraph): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const node of nodes.values()) {
    for (const parent of node.follows) {
      const existing = children.get(parent);
      if (existing) existing.push(node.id);
      else children.set(parent, [node.id]);
    }
  }
  for (const list of children.values()) list.sort();
  return children;
}

function connected(nodes: ChangeGraph, children: Map<string, string[]>): ChangeGraphNode[] {
  return [...nodes.values()].filter(
    (node) =>
      node.follows.length > 0
      || node.supersedes.length > 0
      || node.blockedBy.length > 0
      || (children.get(node.id)?.length ?? 0) > 0,
  );
}

export function renderChangeTree(nodes: ChangeGraph, options: { all?: boolean } = {}): string {
  const children = childrenByParent(nodes);
  const unmet = unmetByChange(nodes);
  const shown = options.all ? [...nodes.values()] : connected(nodes, children);
  const shownIds = new Set(shown.map((node) => node.id));

  // A root is a change that follows nothing. Not "the oldest" — the
  // archive's date prefix is when a change closed, not when it started,
  // and reading order off it is the mistake the graph exists to stop.
  const roots = shown.filter((node) => node.follows.length === 0).map((node) => node.id).sort();

  const lines: string[] = [];
  const printed = new Set<string>();
  const walk = (id: string, depth: number, seen: Set<string>): void => {
    const node = nodes.get(id);
    if (!node) return;
    printed.add(id);
    lines.push(`${"  ".repeat(depth)}${depth === 0 ? "" : "└ "}${label(node, unmet)}`);
    if (seen.has(id)) {
      lines.push(`${"  ".repeat(depth + 1)}└ (cycle back to ${id})`);
      return;
    }
    for (const child of children.get(id) ?? []) {
      // A change with more than one parent appears under each. The
      // relation is a DAG; a rendering that silently dropped an edge
      // would be worse than the flat list it replaces.
      if (shownIds.has(child)) walk(child, depth + 1, new Set([...seen, id]));
    }
  };
  for (const root of roots) walk(root, 0, new Set());

  // Everything in a cycle follows something, so none of it is a root and
  // none of it would print — the whole subgraph would vanish and this
  // would report that no relation exists. The gate fails on a cycle; a
  // renderer that hides one is worse than one that shows it awkwardly.
  for (const id of shown.map((node) => node.id).sort()) {
    if (printed.has(id)) continue;
    if (!lines.includes(UNREACHABLE_HEADING)) lines.push(UNREACHABLE_HEADING);
    walk(id, 1, new Set());
  }

  if (lines.length === 0) lines.push("No change states a relation yet.");
  return lines.join("\n");
}

/** Walks `follows` upward from one change — from a decision back to the
 * reason for it, which is the question that motivated the graph. */
export function renderChangeAncestry(nodes: ChangeGraph, id: string): string {
  if (!nodes.has(id)) return `No change with id "${id}", active or archived.`;
  const unmet = unmetByChange(nodes);

  const lines: string[] = [];
  const walk = (current: string, depth: number, seen: Set<string>): void => {
    const node = nodes.get(current);
    if (!node) {
      lines.push(`${"  ".repeat(depth)}${depth === 0 ? "" : "↑ "}${current} (missing)`);
      return;
    }
    lines.push(`${"  ".repeat(depth)}${depth === 0 ? "" : "↑ "}${label(node, unmet)}`);
    if (seen.has(current)) {
      lines.push(`${"  ".repeat(depth + 1)}↑ (cycle back to ${current})`);
      return;
    }
    for (const parent of node.follows) walk(parent, depth + 1, new Set([...seen, current]));
  };
  walk(id, 0, new Set());

  if (lines.length === 1) lines.push("  (follows nothing)");
  return lines.join("\n");
}
