import path from "node:path";
import * as vscode from "vscode";
import { discoverOpenSpecWorkspace } from "@openspec-ui/core";
import {
  ChangeTreeItem,
  EmptyTreeItem,
  TasksArtifactTreeItem,
  getChangeChildren,
  getTasksArtifactChildren,
  getWorkbenchParent,
  type WorkbenchTreeItem,
} from "./changes-tree.js";

/** Whether a file event is inside `openspec/changes/archive`, the archive
 * itself included: the only events that can change what the Archive view
 * lists (the-pipeline-reads-each-workspace-once). */
export function isUnderArchive(workspaceRoot: string, uri: { fsPath: string }): boolean {
  const relative = path.relative(path.join(workspaceRoot, "openspec", "changes", "archive"), uri.fsPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export class ArchiveTreeProvider implements vscode.TreeDataProvider<WorkbenchTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly workspaceRoot: string) { }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: WorkbenchTreeItem): vscode.TreeItem {
    return element;
  }

  getParent(element: WorkbenchTreeItem): WorkbenchTreeItem | undefined {
    return getWorkbenchParent(element);
  }

  async getChildren(element?: WorkbenchTreeItem): Promise<WorkbenchTreeItem[]> {
    if (element instanceof ChangeTreeItem) {
      return getChangeChildren(element);
    }
    if (element instanceof TasksArtifactTreeItem) {
      return getTasksArtifactChildren(this.workspaceRoot, element);
    }
    if (element) return [];
    const workspace = await discoverOpenSpecWorkspace(this.workspaceRoot, { changes: "archived" });
    if (workspace.archivedChanges.length === 0) {
      return [
        new EmptyTreeItem(
          "No archived changes",
          workspace.archiveExists ? "Archive is empty" : "Created after the first archive",
        ),
      ];
    }
    return workspace.archivedChanges.map(
      (change) => new ChangeTreeItem(change.name, change.path, change.state, change.artifacts, true, undefined, change.schema),
    );
  }
}
