// 1.2 TreeDataProvider для Changes. Статус — из `readChangeState`
// (`@openspec-ui/core`, тот же источник правды, что и в `webui`), не
// пересчитывается здесь заново.

import path from "node:path";
import * as vscode from "vscode";
import { listChanges, readChangeState, type ChangeState } from "@openspec-ui/core";

function iconForState(state: ChangeState): string {
  switch (state) {
    case "draft":
      return "circle-outline";
    case "in-progress":
      return "sync";
    case "implemented":
      return "check";
    case "archived":
      return "archive";
  }
}

export class ChangeTreeItem extends vscode.TreeItem {
  constructor(
    public readonly changeName: string,
    public readonly changeDir: string,
    public readonly state: ChangeState,
  ) {
    super(changeName, vscode.TreeItemCollapsibleState.None);
    this.description = state;
    this.contextValue = "openspec-ui.change";
    this.iconPath = new vscode.ThemeIcon(iconForState(state));
    this.command = {
      command: "vscode.open",
      title: "Open proposal.md",
      arguments: [vscode.Uri.file(path.join(changeDir, "proposal.md"))],
    };
  }
}

export class ChangesTreeProvider implements vscode.TreeDataProvider<ChangeTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly workspaceRoot: string) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: ChangeTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ChangeTreeItem[]> {
    const result = await listChanges({ cwd: this.workspaceRoot });
    const items: ChangeTreeItem[] = [];
    for (const change of result.changes) {
      const changeDir = path.join(this.workspaceRoot, "openspec", "changes", change.name);
      const state = await readChangeState(changeDir);
      if (state === "archived") continue; // показывается в Archive-дереве
      items.push(new ChangeTreeItem(change.name, changeDir, state));
    }
    return items;
  }
}
