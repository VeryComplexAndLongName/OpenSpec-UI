// 1.2 TreeDataProvider для Specs.

import path from "node:path";
import * as vscode from "vscode";
import { listSpecs } from "@openspec-ui/core";

export class SpecTreeItem extends vscode.TreeItem {
  constructor(
    public readonly specId: string,
    requirementCount: number,
    specFilePath: string,
  ) {
    super(specId, vscode.TreeItemCollapsibleState.None);
    this.description = `${requirementCount} requirement${requirementCount === 1 ? "" : "s"}`;
    this.contextValue = "openspec-ui.spec";
    this.iconPath = new vscode.ThemeIcon("book");
    this.command = {
      command: "vscode.open",
      title: "Open spec.md",
      arguments: [vscode.Uri.file(specFilePath)],
    };
  }
}

export class SpecsTreeProvider implements vscode.TreeDataProvider<SpecTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly workspaceRoot: string) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: SpecTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<SpecTreeItem[]> {
    const result = await listSpecs({ cwd: this.workspaceRoot });
    return result.specs.map(
      (spec) =>
        new SpecTreeItem(
          spec.id,
          spec.requirementCount,
          path.join(this.workspaceRoot, "openspec", "specs", spec.id, "spec.md"),
        ),
    );
  }
}
