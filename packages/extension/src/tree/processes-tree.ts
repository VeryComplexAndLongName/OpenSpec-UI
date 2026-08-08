import * as vscode from "vscode";
import type { WorkbenchProcess, WorkbenchProcessScheduler } from "@openspec-ui/core";

function iconForState(state: WorkbenchProcess["state"]): string {
  switch (state) {
    case "queued": return "clock";
    case "running": return "sync~spin";
    case "completed": return "pass-filled";
    case "failed": return "error";
    case "cancelled": return "circle-slash";
    case "interrupted": return "debug-pause";
    case "rolled-back": return "discard";
  }
}

export class ProcessTreeItem extends vscode.TreeItem {
  constructor(public readonly process: WorkbenchProcess) {
    super(process.operation, vscode.TreeItemCollapsibleState.None);
    this.description = [process.changeName, process.state, process.progress].filter(Boolean).join(" · ");
    this.tooltip = process.error ?? process.summary ?? process.progress;
    this.iconPath = new vscode.ThemeIcon(iconForState(process.state));
    const active = process.state === "queued" || process.state === "running";
    if (process.operation === "implement") {
      this.contextValue = active
        ? "openspec-ui.implementationProcess"
        : process.state === "completed" || process.state === "failed" || process.state === "interrupted"
          ? "openspec-ui.rollbackableProcess"
          : "openspec-ui.finishedProcess";
    } else {
      this.contextValue = process.mutating && ["completed", "failed", "interrupted"].includes(process.state)
        ? "openspec-ui.rollbackableProcess"
        : "openspec-ui.finishedProcess";
    }
  }
}

export class ProcessesTreeProvider implements vscode.TreeDataProvider<ProcessTreeItem>, vscode.Disposable {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  private readonly unsubscribe: () => void;

  constructor(private readonly scheduler: WorkbenchProcessScheduler) {
    this.unsubscribe = scheduler.onDidChange(() => this.onDidChangeTreeDataEmitter.fire());
  }

  getTreeItem(element: ProcessTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ProcessTreeItem[] {
    return this.scheduler.list().reverse().map((process) => new ProcessTreeItem(process));
  }

  dispose(): void {
    this.unsubscribe();
    this.onDidChangeTreeDataEmitter.dispose();
  }
}
