// The questions a relation edit asks, and the words it asks them in
// (a-relation-is-set-where-it-is-read).
//
// DW's request was to manage a dependency with a mouse. A tree row can
// carry a command but not a form, so the edit is two quick picks: which
// relation, and which change. Both are built here rather than inline in
// `commands.ts`, because what they offer is the part worth testing - that
// a change is never offered itself, that a relation already stated is
// marked rather than offered twice, and that removing offers only what
// the change actually states.

import * as vscode from "vscode";
import { CHANGE_RELATION_KEYS, type ChangeGraph, type ChangeGraphNode, type ChangeRelationKey } from "@openspec-ui/core";

/** What each relation means, in the words the pick shows. `follows` and
 * `supersedes` are history; `blocked_by` is a schedule that resolves when
 * the change it names is archived. */
const RELATION_WORDS: Record<ChangeRelationKey, { label: string; detail: string }> = {
  follows: {
    label: "Follows",
    detail: "This change grew out of another. History: it never resolves.",
  },
  supersedes: {
    label: "Supersedes",
    detail: "This change corrects a decision another made. History: it never resolves.",
  },
  blocked_by: {
    label: "Blocked by",
    detail: "This change waits on another. Resolves the moment that change is archived.",
  },
};

interface KindItem extends vscode.QuickPickItem {
  key: ChangeRelationKey;
}

/** Which relation the edit is about. */
export async function pickRelationKind(change: string): Promise<ChangeRelationKey | undefined> {
  const items: KindItem[] = CHANGE_RELATION_KEYS.map((key) => ({
    key,
    label: RELATION_WORDS[key].label,
    detail: RELATION_WORDS[key].detail,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    title: `Relation to state on ${change}`,
    placeHolder: "Which relation",
  });
  return picked?.key;
}

interface ChangeItem extends vscode.QuickPickItem {
  id: string;
}

/** Which change the relation names.
 *
 * Every change the workspace knows, active first, archived beneath: most
 * relations point at archived work, which is where their value is. The
 * change being edited is never offered - core refuses a self-relation,
 * and a question whose every answer may be refused is a question worth
 * not asking. One already stated is marked rather than removed, so a
 * reader can see that it is there. */
export async function pickChangeToRelate(
  graph: ChangeGraph,
  change: string,
  key: ChangeRelationKey,
): Promise<string | undefined> {
  const stated = new Set(relationsOf(graph.get(change), key));
  const items: ChangeItem[] = [...graph.values()]
    .filter((node) => node.id !== change)
    .sort((left, right) => Number(left.archived) - Number(right.archived) || left.id.localeCompare(right.id))
    .map((node) => ({
      id: node.id,
      label: node.id,
      description: [node.archived ? "archived" : undefined, stated.has(node.id) ? "already stated" : undefined]
        .filter((word) => word !== undefined)
        .join(", "),
    }));
  if (items.length === 0) return undefined;
  const picked = await vscode.window.showQuickPick(items, {
    title: `${RELATION_WORDS[key].label}: which change`,
    placeHolder: "The change this relation names",
    matchOnDescription: true,
  });
  return picked?.id;
}

export interface StatedRelation {
  key: ChangeRelationKey;
  id: string;
}

interface StatedItem extends vscode.QuickPickItem {
  relation: StatedRelation;
}

/** Which of the relations a change states to take back. Only what it
 * actually states: a reader should never be able to remove something that
 * was not there. */
export async function pickRelationToRemove(node: ChangeGraphNode | undefined): Promise<StatedRelation | undefined> {
  const stated: StatedRelation[] = CHANGE_RELATION_KEYS.flatMap((key) =>
    relationsOf(node, key).map((id) => ({ key, id })),
  );
  if (stated.length === 0) {
    void vscode.window.showInformationMessage(
      `OpenSpec Workbench: ${node?.id ?? "this change"} states no relation to remove.`,
    );
    return undefined;
  }
  const items: StatedItem[] = stated.map((relation) => ({
    relation,
    label: relation.id,
    description: RELATION_WORDS[relation.key].label,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    title: `Relation to remove from ${node?.id ?? "this change"}`,
    placeHolder: "The relation to take back",
    matchOnDescription: true,
  });
  return picked?.relation;
}

function relationsOf(node: ChangeGraphNode | undefined, key: ChangeRelationKey): string[] {
  if (!node) return [];
  if (key === "blocked_by") return node.blockedBy;
  return node[key];
}
