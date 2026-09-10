import * as vscode from "vscode";
import { collectHumanOnlyInbox } from "@openspec-ui/core";
import { EmptyTreeItem } from "./changes-tree.js";

/** One open human-only item, from one active change's `tasks.md`. Reveals
 * into that file at that line when selected — the same target
 * `openspec-ui.revealTask` already opens for `TaskTreeItem` in the
 * Changes tree, reused here rather than duplicated (both carry
 * `changeDir`/`lineNumber`/`text`, which is all that command reads).
 *
 * Read-only by design (design.md, "nothing in the inbox marks an item
 * done"): no `deleteTask`-style command is bound to this contextValue in
 * package.json, so no control to mutate or complete the item appears in
 * this view's context menu, unlike the Changes tree's own task rows. */
export class HumanOnlyInboxItemTreeItem extends vscode.TreeItem {
  constructor(
    public readonly changeName: string,
    public readonly changeDir: string,
    public readonly lineNumber: number,
    public readonly text: string,
  ) {
    super(text, vscode.TreeItemCollapsibleState.None);
    this.id = `human-only-inbox:${changeName}:${lineNumber}`;
    this.description = changeName;
    this.contextValue = "openspec-ui.humanOnlyInboxItem";
    this.iconPath = new vscode.ThemeIcon("watch");
    this.command = { command: "openspec-ui.revealTask", title: "Reveal Task", arguments: [this] };
  }
}

export type HumanOnlyInboxTreeNode = HumanOnlyInboxItemTreeItem | EmptyTreeItem;

export class HumanOnlyInboxTreeProvider implements vscode.TreeDataProvider<HumanOnlyInboxTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly workspaceRoot: string) { }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
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
      new HumanOnlyInboxItemTreeItem(item.changeName, item.changeDir, item.lineNumber, item.text));

    if (items.length === 0) {
      return [new EmptyTreeItem("Nothing is waiting on a person", "No open human-only item in any active change")];
    }
    return items;
  }
}
