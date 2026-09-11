// Where each change goes in the pipeline picture — ADR 0025.
//
// A pure function of `ChangeReadinessReport`, and it lives here rather
// than in the view for one reason: the terminal and the shell must place
// changes identically. A second implementation in the browser would be
// free to drift, and the drift would be invisible — both pictures would
// keep looking plausible, and whichever one a person happened to be
// using is the one they would believe.
//
// Nothing here reads the filesystem, git, or a lease. Every fact it
// arranges was derived once, by `readChangeReadiness`.

import type { ChangeReadiness, ChangeReadinessReport } from "./change-readiness.js";

export interface ChangeLayoutNode {
  change: ChangeReadiness;
  /** Depth in the declared order: zero where nothing active blocks it. */
  column: number;
  /** Position within the column, by change name. */
  row: number;
}

/** A declared blocker, from the blocker to the change it blocks.
 *
 * Only this. A collision is NOT an edge: two changes that would meet in
 * one spec file have no precedence between them, and a line would assert
 * a sequence the repository does not contain (ADR 0025). */
export interface ChangeLayoutEdge {
  from: string;
  to: string;
}

export interface ChangeLayout {
  /** Change names by column, each column ordered by name. */
  columns: string[][];
  nodes: ChangeLayoutNode[];
  edges: ChangeLayoutEdge[];
  /** Groups of changes that declare a cycle of blockers between them,
   * each group sorted. Empty in a repository whose declarations are an
   * order, which is all of them until somebody writes a loop. */
  cycles: string[][];
  /** Every change with no place in the order: the members of a cycle,
   * and anything waiting on one. Sorted, and a superset of `cycles`
   * flattened.
   *
   * Named rather than placed. A cycle has no depth, and a picture that
   * quietly put one somewhere would be a wrong answer that looks like a
   * right one — believed for exactly as long as nobody checked. */
  unplaced: string[];
}

export function layoutChanges(report: ChangeReadinessReport): ChangeLayout {
  const byName = new Map(report.changes.map((change) => [change.changeName, change]));
  // Kept to changes that are present: a blocker naming something this
  // report does not contain is not a node, so it is not a relation.
  const blockersOf = new Map<string, string[]>(
    report.changes.map((change) => [
      change.changeName,
      change.blockers.filter((blocker) => byName.has(blocker) && blocker !== change.changeName),
    ]),
  );
  const selfBlocked = new Set(
    report.changes.filter((change) => change.blockers.includes(change.changeName)).map((c) => c.changeName),
  );

  const cycles = findCycles(blockersOf, selfBlocked);
  const unplaceable = new Set<string>(cycles.flat());
  spreadUnplaceable(blockersOf, unplaceable);

  const depths = new Map<string, number>();
  for (const name of blockersOf.keys()) {
    if (!unplaceable.has(name)) depths.set(name, depthOf(name, blockersOf, depths, unplaceable));
  }

  const columns: string[][] = [];
  for (const [name, depth] of [...depths].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    while (columns.length <= depth) columns.push([]);
    (columns[depth] as string[]).push(name);
  }

  const nodes: ChangeLayoutNode[] = [];
  columns.forEach((names, column) => {
    names.forEach((name, row) => {
      nodes.push({ change: byName.get(name) as ChangeReadiness, column, row });
    });
  });

  const edges: ChangeLayoutEdge[] = [];
  for (const [name, blockers] of [...blockersOf].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    for (const blocker of [...blockers].sort()) edges.push({ from: blocker, to: name });
  }

  return { columns, nodes, edges, cycles, unplaced: [...unplaceable].sort() };
}

/** Depth: zero where nothing active blocks it, otherwise one past the
 * deepest thing it is blocked by. Memoised, and only ever called for
 * names already established to have a finite depth. */
function depthOf(
  name: string,
  blockersOf: Map<string, string[]>,
  depths: Map<string, number>,
  unplaceable: Set<string>,
): number {
  const known = depths.get(name);
  if (known !== undefined) return known;
  let depth = 0;
  for (const blocker of blockersOf.get(name) ?? []) {
    if (unplaceable.has(blocker)) continue;
    depth = Math.max(depth, depthOf(blocker, blockersOf, depths, unplaceable) + 1);
  }
  depths.set(name, depth);
  return depth;
}

/** Tarjan's strongly connected components, over the "is blocked by"
 * relation. Any component with more than one member is a cycle; a change
 * that names itself is one on its own.
 *
 * Iterative rather than recursive: a repository's changes are few, but a
 * stack overflow in a layout function would surface as a blank tab
 * rather than as an error anybody could act on. */
function findCycles(blockersOf: Map<string, string[]>, selfBlocked: Set<string>): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let counter = 0;

  for (const root of [...blockersOf.keys()].sort()) {
    if (index.has(root)) continue;
    // Each frame keeps its own position in its neighbour list, which is
    // what a recursive version would keep in the call stack.
    const work: Array<{ name: string; next: number }> = [{ name: root, next: 0 }];
    index.set(root, counter);
    low.set(root, counter);
    counter += 1;
    stack.push(root);
    onStack.add(root);

    while (work.length > 0) {
      const frame = work[work.length - 1] as { name: string; next: number };
      const neighbours = blockersOf.get(frame.name) ?? [];
      if (frame.next < neighbours.length) {
        const neighbour = neighbours[frame.next] as string;
        frame.next += 1;
        if (!index.has(neighbour)) {
          index.set(neighbour, counter);
          low.set(neighbour, counter);
          counter += 1;
          stack.push(neighbour);
          onStack.add(neighbour);
          work.push({ name: neighbour, next: 0 });
        } else if (onStack.has(neighbour)) {
          low.set(frame.name, Math.min(low.get(frame.name) as number, index.get(neighbour) as number));
        }
        continue;
      }

      work.pop();
      const parent = work[work.length - 1];
      if (parent) {
        low.set(parent.name, Math.min(low.get(parent.name) as number, low.get(frame.name) as number));
      }
      if (low.get(frame.name) === index.get(frame.name)) {
        const component: string[] = [];
        for (;;) {
          const popped = stack.pop() as string;
          onStack.delete(popped);
          component.push(popped);
          if (popped === frame.name) break;
        }
        if (component.length > 1 || selfBlocked.has(frame.name)) cycles.push(component.sort());
      }
    }
  }

  return cycles.sort((a, b) => ((a[0] as string) < (b[0] as string) ? -1 : 1));
}

/** Anything waiting on something that cannot be placed cannot be placed
 * either — there is no column one past nowhere. Repeated until it stops
 * growing, which is at most once per change. */
function spreadUnplaceable(blockersOf: Map<string, string[]>, unplaceable: Set<string>): void {
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, blockers] of blockersOf) {
      if (unplaceable.has(name)) continue;
      if (blockers.some((blocker) => unplaceable.has(blocker))) {
        unplaceable.add(name);
        grew = true;
      }
    }
  }
}
