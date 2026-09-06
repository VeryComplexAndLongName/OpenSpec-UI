// See openspec/changes/human-only-inbox/proposal.md, "A named successor
// that was never created" — three changes in a row said "Successor
// created: X" in their tasks.md prose, archived, and the successor's own
// `follows` relation was the only thing that made the claim real. This
// check verifies that relation exists; it does not infer one from prose
// it cannot recognize.
//
// Deliberately narrow (design.md, "Rejected: guessing which prose names a
// successor"): a matcher loose enough to catch every way an author might
// phrase a successor would also accuse changes that promised nothing. A
// false accusation on a merge gate is worse than the silence it replaces.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { readChangeGraph, type ChangeGraph } from "./change-graph.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";

/** The exact wording this check looks for — see
 * `change-dependency-graph`'s proposal.md and
 * `every-varying-check-has-a-budget`'s tasks.md task 4.3, the two places
 * this phrasing is already on record: "Successor created: `id`", with the
 * id optionally wrapped in a bold span (`**\`id\`**`). Documented here,
 * not only in design.md, so the failure message and the source agree on
 * what was searched for. */
export const NAMED_SUCCESSOR_RE = /Successor created:\s*\*{0,2}`([a-z0-9][a-z0-9._-]*)`\*{0,2}/gi;

export interface NamedSuccessor {
  changeId: string;
  successorId: string;
}

const QUOTE_CHARS = new Set(['"', "'", "“", "‘"]);

/** Every "Successor created: `id`" this change's tasks.md names, in the
 * order they appear. A change may name more than one over its lifetime,
 * though none in this repository has yet.
 *
 * Skips a match immediately preceded by a quote character: this file's
 * own tasks.md quotes `every-varying-check-has-a-budget`'s wording as an
 * example ("... wrote \"Successor created: ...\", and it is the phrasing
 * to match first") to document what task 2.1 searches for, and a naive
 * match would read that documentation as this change naming a successor
 * of its own — a false accusation the exact kind this check exists to
 * avoid producing. A real declaration starts its own sentence, never
 * inside a quoted description of the wording itself. */
export function findNamedSuccessors(changeId: string, tasksContent: string): NamedSuccessor[] {
  const found: NamedSuccessor[] = [];
  for (const match of tasksContent.matchAll(NAMED_SUCCESSOR_RE)) {
    const successorId = match[1];
    if (!successorId) continue;
    const precedingChar = tasksContent[(match.index ?? 0) - 1];
    if (precedingChar !== undefined && QUOTE_CHARS.has(precedingChar)) continue;
    found.push({ changeId, successorId });
  }
  return found;
}

export interface OrphanedSuccessor extends NamedSuccessor {
  reason: string;
}

/** A successor is real when a change of the named id exists — active or
 * archived, since `readChangeGraph` keys both by the id a relation names
 * — and that change states `follows` on the change that named it.
 *
 * Both halves are load-bearing. Accepting any change that follows the
 * naming change would pass a promise of `later` that produced `other`
 * instead: the requirement is "a named successor is a real one", and the
 * name is the part being checked. Accepting the id's mere existence
 * without the relation would pass a change that happens to share the
 * name, which is why `follows` is still required. */
function isRealSuccessor(graph: ChangeGraph, successor: NamedSuccessor): boolean {
  const named = graph.get(successor.successorId);
  return named !== undefined && named.follows.includes(successor.changeId);
}

/** Fails a named successor unless a change of that id states `follows` on
 * the change that named it. Reads every active change's `tasks.md` (a named
 * successor is a promise a change makes about its own residue, so only
 * that change's own tasks are searched) plus the repository's stated
 * relation graph (active and archived, per `readChangeGraph`). */
export async function checkNamedSuccessors(root: string): Promise<OrphanedSuccessor[]> {
  const [workspace, graph] = await Promise.all([
    discoverOpenSpecWorkspace(root),
    readChangeGraph(root),
  ]);

  const violations: OrphanedSuccessor[] = [];
  for (const change of workspace.changes) {
    const tasksPath = path.join(change.path, "tasks.md");
    let content: string;
    try {
      content = await readFile(tasksPath, "utf8");
    } catch {
      continue;
    }

    for (const successor of findNamedSuccessors(change.name, content)) {
      if (isRealSuccessor(graph, successor)) continue;
      violations.push({
        ...successor,
        reason: `${change.name}'s tasks.md names "Successor created: \`${successor.successorId}\`"`
          + ` but no change \`${successor.successorId}\` states \`follows: ${successor.changeId}\``,
      });
    }
  }
  return violations;
}
