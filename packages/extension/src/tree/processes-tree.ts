import * as vscode from "vscode";
import { readTaskChecklist, type WorkbenchProcess, type WorkbenchProcessScheduler } from "@openspec-ui/core";

function iconForState(state: WorkbenchProcess["state"]): string {
  switch (state) {
    case "queued": return "clock";
    case "running": return "sync~spin";
    // Distinct from "running" — see harness-suspendable-stage/tasks.md
    // task 6.1: rendering a suspended process as running is the confusion
    // this state exists to remove.
    case "suspended": return "watch";
    case "completed": return "pass-filled";
    case "failed": return "error";
    case "cancelled": return "circle-slash";
    case "interrupted": return "debug-pause";
    case "rolled-back": return "discard";
  }
}

/** Percent-complete for the process's associated change, derived from
 * the change's real `tasks.md` checkbox state — not the process's own
 * free-text `progress` field. See openspec/changes/agentic-harness/
 * design.md, "Percent-complete source". `undefined` when the process has
 * no `changeName`, or that change has no tasks yet. */
function formatPercent(completedTasks: number, totalTasks: number): string | undefined {
  if (totalTasks === 0) return undefined;
  return `${Math.round((completedTasks / totalTasks) * 100)}%`;
}

/** `undefined` — never `"$0.00"` — when the process's audit entry carried
 * no usage (see `WorkbenchProcess.usage`'s own doc comment): an absent
 * cost means unmeasured, not free. */
function formatCostUsd(costUsd: number | undefined): string | undefined {
  return costUsd === undefined ? undefined : `$${costUsd.toFixed(2)}`;
}

export class ProcessTreeItem extends vscode.TreeItem {
  constructor(public readonly process: WorkbenchProcess, percent: string | undefined) {
    super(process.operation, vscode.TreeItemCollapsibleState.None);
    this.description = [
      process.changeName,
      process.agentId,
      percent,
      process.state,
      process.waitingFor,
      process.progress,
      formatCostUsd(process.usage?.costUsd),
    ]
      .filter(Boolean)
      .join(" · ");
    this.tooltip = process.error ?? process.waitingFor ?? process.summary ?? process.progress;
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

  constructor(private readonly scheduler: WorkbenchProcessScheduler, private readonly workspaceRoot: string) {
    this.unsubscribe = scheduler.onDidChange(() => this.onDidChangeTreeDataEmitter.fire());
  }

  getTreeItem(element: ProcessTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ProcessTreeItem[]> {
    const processes = this.scheduler.list().reverse();
    const changeNames = [...new Set(processes.map((process) => process.changeName).filter((name): name is string => Boolean(name)))];
    const percentByChange = new Map<string, string | undefined>();
    await Promise.all(
      changeNames.map(async (changeName) => {
        // Active first (the common case for a running/recent process);
        // archived changes can still have rollback-eligible processes.
        const items = await readTaskChecklist(this.workspaceRoot, changeName, false)
          .then((active) => (active.length > 0 ? active : readTaskChecklist(this.workspaceRoot, changeName, true)))
          .catch(() => []);
        const completedTasks = items.filter((item) => item.done).length;
        percentByChange.set(changeName, formatPercent(completedTasks, items.length));
      }),
    );

    return processes.map(
      (process) => new ProcessTreeItem(process, process.changeName ? percentByChange.get(process.changeName) : undefined),
    );
  }

  dispose(): void {
    this.unsubscribe();
    this.onDidChangeTreeDataEmitter.dispose();
  }
}
