// Wires `openspec-ui.followSelectionInChangeGraph` — off by default (design.md,
// "locating is a request; following is opt-in"): the graph shows only
// changes that state a relation, so for most changes there is nothing to
// reveal, and a behaviour that silently does nothing most of the time reads
// as broken.

import * as vscode from "vscode";
import { readConfig } from "./config.js";
import { findGraphRows } from "./tree/change-graph-tree.js";
import type { GraphTreeNode } from "./tree/change-graph-tree.js";

/** The part of a `vscode.TreeView` this needs from Changes/Archive: an
 * event fired with the new selection. */
export interface SelectionSourceView {
  readonly onDidChangeSelection: vscode.Event<{ selection: readonly unknown[] }>;
}

/** The part of a `vscode.TreeView` this needs from the Change Graph: a
 * place to reveal a row into, without stealing focus from the list the
 * reader is browsing (tasks.md 4.2). */
export interface SelectionTargetView {
  reveal(
    element: GraphTreeNode,
    options?: { select?: boolean; focus?: boolean; expand?: boolean | number },
  ): Thenable<void>;
}

const CHANGE_CONTEXT_VALUES = new Set(["openspec-ui.activeChange", "openspec-ui.archivedChange"]);

function changeNameOf(candidate: unknown): string | undefined {
  if (typeof candidate !== "object" || candidate === null) return undefined;
  const { contextValue, changeName } = candidate as { contextValue?: unknown; changeName?: unknown };
  if (typeof contextValue !== "string" || !CHANGE_CONTEXT_VALUES.has(contextValue)) return undefined;
  return typeof changeName === "string" ? changeName : undefined;
}

export interface FollowSelectionDeps {
  getWorkspaceRoot: () => string | undefined;
  changesView: SelectionSourceView;
  archiveView: SelectionSourceView;
  changeGraphView: SelectionTargetView;
}

/** Subscribes to the Changes and Archive views' selection only while
 * `openspec-ui.followSelectionInChangeGraph` is on, and unsubscribes the
 * moment it's turned off — without requiring a reload (tasks.md 4.4).
 * Returns a `Disposable` that tears down both the subscription (if any)
 * and the configuration listener. */
export function registerFollowSelection(deps: FollowSelectionDeps): vscode.Disposable {
  let subscriptions: vscode.Disposable[] | undefined;

  const revealSelection = async (selection: readonly unknown[]): Promise<void> => {
    if (selection.length !== 1) return;
    const changeName = changeNameOf(selection[0]);
    if (!changeName) return;
    const workspaceRoot = deps.getWorkspaceRoot();
    if (!workspaceRoot) return;
    // Silent when there's nothing to reveal (tasks.md 4.3) — the explicit
    // command explains; the automatic one must not interrupt.
    const rows = await findGraphRows(workspaceRoot, changeName);
    for (const [index, row] of rows.entries()) {
      await deps.changeGraphView.reveal(row, { select: index === 0, focus: false, expand: true });
    }
  };

  const subscribe = (): void => {
    if (subscriptions) return;
    subscriptions = [
      deps.changesView.onDidChangeSelection((e) => void revealSelection(e.selection)),
      deps.archiveView.onDidChangeSelection((e) => void revealSelection(e.selection)),
    ];
  };
  const unsubscribe = (): void => {
    if (!subscriptions) return;
    for (const subscription of subscriptions) subscription.dispose();
    subscriptions = undefined;
  };

  if (readConfig().followSelectionInChangeGraph) subscribe();

  const configSubscription = vscode.workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration("openspec-ui.followSelectionInChangeGraph")) return;
    if (readConfig().followSelectionInChangeGraph) subscribe();
    else unsubscribe();
  });

  return {
    dispose: () => {
      unsubscribe();
      configSubscription.dispose();
    },
  };
}
