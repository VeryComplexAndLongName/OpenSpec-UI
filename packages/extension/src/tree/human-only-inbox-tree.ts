import * as vscode from "vscode";
import { collectHumanOnlyInbox, describeWaitingOn, type WaitingOn } from "@openspec-ui/core";
import { EmptyTreeItem } from "./changes-tree.js";

/** The `contextValue` of a row whose item names an agent this build
 * carries. `package.json`'s `view/item/context` binds
 * `openspec-ui.runDelegatedItem` to exactly this value, so a row
 * waiting on a person — or on an id nothing recognises — carries no run
 * control at all rather than one that refuses when clicked.
 *
 * A distinct value rather than a flag on the item: a menu's `when`
 * clause can read a contextValue and nothing else. See
 * a-delegated-item-runs-its-agent. */
export const RUNNABLE_INBOX_ITEM_CONTEXT = "openspec-ui.humanOnlyInboxItem.agent";
export const WAITING_INBOX_ITEM_CONTEXT = "openspec-ui.humanOnlyInboxItem";

/** One open human-only item, from one active change's `tasks.md`. Reveals
 * into that file at that line when selected — the same target
 * `openspec-ui.revealTask` already opens for `TaskTreeItem` in the
 * Changes tree, reused here rather than duplicated (both carry
 * `changeDir`/`lineNumber`/`text`, which is all that command reads).
 *
 * Nothing here marks an item done (design.md, "nothing in the inbox
 * marks an item done"). Since a-delegated-item-runs-its-agent a row
 * whose item names a registered agent does carry one control — running
 * that agent against that item — and the run's own gate is what decides
 * whether the item may close, not this view. */
export class HumanOnlyInboxItemTreeItem extends vscode.TreeItem {
  constructor(
    public readonly changeName: string,
    public readonly changeDir: string,
    public readonly lineNumber: number,
    public readonly text: string,
    public readonly waitingOn: WaitingOn,
    /** What the last run of this item reported, where one has been run
     * from this session. Shown on the row itself: an outcome in a
     * notification that has been dismissed is an outcome nobody can go
     * back and read. */
    outcome?: string,
  ) {
    super(text, vscode.TreeItemCollapsibleState.None);
    this.id = `human-only-inbox:${changeName}:${lineNumber}`;
    // Who it waits on, not only which change it belongs to: an item
    // assigned to an agent that has not run and an item nobody can
    // close read the same otherwise. See
    // a-live-check-names-who-performs-it.
    const waiting = `${changeName} — waiting on ${describeWaitingOn(waitingOn)}`;
    this.description = outcome === undefined ? waiting : `${waiting} — ${outcome}`;
    this.contextValue = waitingOn.kind === "agent" && waitingOn.known
      ? RUNNABLE_INBOX_ITEM_CONTEXT
      : WAITING_INBOX_ITEM_CONTEXT;
    this.iconPath = new vscode.ThemeIcon("watch");
    this.command = { command: "openspec-ui.revealTask", title: "Reveal Task", arguments: [this] };
  }
}

export type HumanOnlyInboxTreeNode = HumanOnlyInboxItemTreeItem | EmptyTreeItem;

export class HumanOnlyInboxTreeProvider implements vscode.TreeDataProvider<HumanOnlyInboxTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  /** Keyed by the row id, so an outcome survives the refresh that
   * follows a run — the run usually rewrites `tasks.md`, and the row is
   * rebuilt from the new reading. */
  private readonly outcomes = new Map<string, string>();

  constructor(private readonly workspaceRoot: string) { }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  /** Records what a run reported against the row it was started from,
   * and refreshes so the row shows it. */
  reportOutcome(item: HumanOnlyInboxItemTreeItem, outcome: string): void {
    this.outcomes.set(`human-only-inbox:${item.changeName}:${item.lineNumber}`, outcome);
    this.refresh();
  }

  getTreeItem(element: HumanOnlyInboxTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: HumanOnlyInboxTreeNode): Promise<HumanOnlyInboxTreeNode[]> {
    if (element) return [];

    // The same collector the standalone shell reads. It was this loop,
    // here, which is why one host could answer "what is waiting on a
    // person" and the other could not. See human-only-inbox-in-the-shell.
    const inbox = await collectHumanOnlyInbox(this.workspaceRoot);
    const items = inbox.items.map((item) =>
      new HumanOnlyInboxItemTreeItem(
        item.changeName,
        item.changeDir,
        item.lineNumber,
        item.text,
        item.waitingOn,
        this.outcomes.get(`human-only-inbox:${item.changeName}:${item.lineNumber}`),
      ));

    if (items.length === 0) {
      return [new EmptyTreeItem("Nothing is waiting", "No open item waiting on a person or an agent in any active change")];
    }
    return items;
  }
}
