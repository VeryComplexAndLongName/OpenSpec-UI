import * as vscode from "vscode";
import { discoverOpenSpecWorkspace } from "@openspec-ui/core";
import { ArtifactTreeItem, ChangeTreeItem, EmptyTreeItem, type WorkbenchTreeItem } from "./changes-tree.js";

export class ArchiveTreeProvider implements vscode.TreeDataProvider<WorkbenchTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly workspaceRoot: string) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: WorkbenchTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkbenchTreeItem): Promise<WorkbenchTreeItem[]> {
    if (element instanceof ChangeTreeItem) {
      return element.artifacts.map(
        (artifact) => new ArtifactTreeItem(
          artifact.kind === "delta-spec" ? `Spec: ${artifact.label}` : artifact.label,
          artifact.path,
          artifact.exists,
        ),
      );
    }
    if (element) return [];
    const workspace = await discoverOpenSpecWorkspace(this.workspaceRoot);
    if (workspace.archivedChanges.length === 0) {
      return [
        new EmptyTreeItem(
          "No archived changes",
          workspace.archiveExists ? "Archive is empty" : "Created after the first archive",
        ),
      ];
    }
    return workspace.archivedChanges.map(
      (change) => new ChangeTreeItem(change.name, change.path, change.state, change.artifacts, true),
    );
  }
}
