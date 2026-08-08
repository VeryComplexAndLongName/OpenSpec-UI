import * as vscode from "vscode";
import {
  discoverOpenSpecWorkspace,
  type ChangeState,
  type WorkbenchArtifact,
} from "@openspec-ui/core";

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
    public readonly artifacts: WorkbenchArtifact[] = [],
    public readonly archived = false,
  ) {
    super(changeName, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = state;
    this.contextValue = archived ? "openspec-ui.archivedChange" : "openspec-ui.activeChange";
    this.iconPath = new vscode.ThemeIcon(iconForState(state));
  }
}

export class ArtifactTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly artifactPath: string,
    public readonly exists: boolean,
    contextValue = "openspec-ui.artifact",
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = exists ? undefined : "missing";
    this.contextValue = contextValue;
    this.iconPath = new vscode.ThemeIcon(exists ? "markdown" : "warning");
    this.command = {
      command: "vscode.open",
      title: `Open ${label}`,
      arguments: [vscode.Uri.file(artifactPath)],
    };
  }
}

export class EmptyTreeItem extends vscode.TreeItem {
  constructor(label: string, description: string, command?: vscode.Command) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.contextValue = "openspec-ui.empty";
    this.iconPath = new vscode.ThemeIcon("info");
    this.command = command;
  }
}

export type WorkbenchTreeItem = ChangeTreeItem | ArtifactTreeItem | EmptyTreeItem;

export class ChangesTreeProvider implements vscode.TreeDataProvider<WorkbenchTreeItem> {
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
        (artifact) =>
          new ArtifactTreeItem(
            artifact.kind === "delta-spec" ? `Spec: ${artifact.label}` : artifact.label,
            artifact.path,
            artifact.exists,
          ),
      );
    }

    if (element) return [];
    const workspace = await discoverOpenSpecWorkspace(this.workspaceRoot);
    const items: WorkbenchTreeItem[] = [];
    items.push(
      new ArtifactTreeItem(
        "OpenSpec Configuration",
        workspace.configPath,
        workspace.configExists,
        "openspec-ui.config",
      ),
    );
    for (const change of workspace.changes) {
      items.push(new ChangeTreeItem(change.name, change.path, change.state, change.artifacts, false));
    }
    if (workspace.changes.length === 0) {
      items.push(workspace.initialized
        ? new EmptyTreeItem("No active changes", "Create an OpenSpec change to begin")
        : new EmptyTreeItem(
            "Initialize OpenSpec",
            "Set up this workspace",
            { command: "openspec-ui.initialize", title: "Initialize OpenSpec" },
          ));
    }
    return items;
  }
}
