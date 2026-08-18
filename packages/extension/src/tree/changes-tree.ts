import * as vscode from "vscode";
import {
  discoverOpenSpecWorkspace,
  readTaskChecklist,
  type ChangeState,
  type WorkbenchArtifact,
} from "@openspec-ui/core";

// Every TreeItem subclass here sets an explicit, stable `.id`. Without one,
// VS Code falls back to a label-derived identity; since every getChildren()
// call below constructs fresh instances (never reuses object references),
// that fallback can desync across refreshes — reported live as tasks
// rendering flush with their parent Change instead of nested, and losing
// collapse/expand state. See openspec/changes/tree-item-stable-ids/proposal.md.

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
    this.id = `change:${archived ? "archived" : "active"}:${changeName}`;
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
    this.id = `artifact:${artifactPath}`;
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

/** The `tasks.md` artifact specifically — unlike every other artifact
 * (Proposal, Design, Spec: X), this one has real children: its individual
 * checklist items. Previously those items were returned as flat siblings
 * of this item (and of Proposal/Design/Spec) directly under the Change,
 * which is the actual bug reported live: "tasks are not nested under
 * Tasks, they're next to it." Fixing the tree-item `.id` fallback
 * (`tree-item-stable-ids`) was necessary but not sufficient — the real
 * fix is this class existing at all, giving `tasks.md` real
 * collapsible/expandable children instead of a flat sibling list. Keeps
 * `ArtifactTreeItem`'s open-on-click `.command`; the disclosure arrow
 * (collapse/expand) is independent of that click target in VS Code. */
export class TasksArtifactTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    artifactPath: string,
    exists: boolean,
    public readonly changeName: string,
    public readonly changeDir: string,
    public readonly archived: boolean,
  ) {
    super(label, exists ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    this.id = `artifact:${artifactPath}`;
    this.description = exists ? undefined : "missing";
    this.contextValue = "openspec-ui.tasksArtifact";
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
    this.id = `empty:${label}`;
    this.description = description;
    this.contextValue = "openspec-ui.empty";
    this.iconPath = new vscode.ThemeIcon("info");
    this.command = command;
  }
}

export class TaskTreeItem extends vscode.TreeItem {
  constructor(
    public readonly changeName: string,
    public readonly changeDir: string,
    public readonly archived: boolean,
    public readonly lineNumber: number,
    public readonly text: string,
    public readonly done: boolean,
  ) {
    super(text, vscode.TreeItemCollapsibleState.None);
    this.id = `task:${archived ? "archived" : "active"}:${changeName}:${lineNumber}`;
    this.description = done ? "done" : undefined;
    this.contextValue = archived
      ? "openspec-ui.archivedTask"
      : done
        ? "openspec-ui.activeTaskDone"
        : "openspec-ui.activeTask";
    if (!archived && done) {
      this.tooltip = `${text}\n\nDone tasks can't be deleted.`;
    }
    this.iconPath = new vscode.ThemeIcon(done ? "check" : "circle-large-outline");
    this.command = { command: "openspec-ui.revealTask", title: "Reveal Task", arguments: [this] };
  }
}

/** Groups the three repo-bootstrap Command Palette actions
 * (`repo-bootstrap-snippets`) under a visible tree node — those commands
 * previously had no tree/menu presence at all, which review found made
 * them effectively undiscoverable. See
 * openspec/changes/repo-bootstrap-tree-ui/proposal.md. */
export class RepoBootstrapRootTreeItem extends vscode.TreeItem {
  constructor() {
    super("Repository Setup", vscode.TreeItemCollapsibleState.Collapsed);
    this.id = "repo-bootstrap-root";
    this.description = "CLAUDE.md, dependabot.yml, ...";
    this.contextValue = "openspec-ui.repoBootstrapRoot";
    this.iconPath = new vscode.ThemeIcon("tools");
  }
}

export class RepoBootstrapActionTreeItem extends vscode.TreeItem {
  constructor(label: string, description: string, command: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.id = `repo-bootstrap-action:${command}`;
    this.description = description;
    this.contextValue = "openspec-ui.repoBootstrapAction";
    this.iconPath = new vscode.ThemeIcon(icon);
    this.command = { command, title: label };
  }
}

export function getRepoBootstrapActions(): RepoBootstrapActionTreeItem[] {
  return [
    new RepoBootstrapActionTreeItem(
      "Generate Agent Instructions",
      "CLAUDE.md / AGENTS.md",
      "openspec-ui.generateAgentInstructions",
      "book",
    ),
    new RepoBootstrapActionTreeItem(
      "Configure Dependabot",
      ".github/dependabot.yml",
      "openspec-ui.configureDependabot",
      "shield",
    ),
    new RepoBootstrapActionTreeItem(
      "Generate Path-Scoped Copilot Instructions",
      ".github/instructions/<subtype>.instructions.md",
      "openspec-ui.generateSubtypeInstructions",
      "file-code",
    ),
  ];
}

export type WorkbenchTreeItem =
  | ChangeTreeItem
  | ArtifactTreeItem
  | TasksArtifactTreeItem
  | EmptyTreeItem
  | TaskTreeItem
  | RepoBootstrapRootTreeItem
  | RepoBootstrapActionTreeItem;

/** Shared by `ChangesTreeProvider` and `ArchiveTreeProvider` — both trees
 * expand a `ChangeTreeItem` the same way: its artifacts, with the
 * `tasks.md` artifact rendered as a `TasksArtifactTreeItem` so its
 * checklist items nest under *it*, not flat alongside Proposal/Design/
 * Spec. See openspec/changes/nest-tasks-under-tasks-artifact/design.md. */
export function getChangeChildren(element: ChangeTreeItem): WorkbenchTreeItem[] {
  return element.artifacts.map((artifact) => {
    if (artifact.kind === "tasks") {
      return new TasksArtifactTreeItem(
        artifact.label,
        artifact.path,
        artifact.exists,
        element.changeName,
        element.changeDir,
        element.archived,
      );
    }
    return new ArtifactTreeItem(
      artifact.kind === "delta-spec" ? `Spec: ${artifact.label}` : artifact.label,
      artifact.path,
      artifact.exists,
    );
  });
}

/** Children of a `TasksArtifactTreeItem` — the individual `tasks.md`
 * checklist items. Split out from `getChangeChildren` because it needs
 * to run lazily, only when the user actually expands "Tasks" (matching
 * how VS Code TreeDataProvider.getChildren is meant to be used — cheap
 * per node, not eagerly computing the whole subtree up front). */
export async function getTasksArtifactChildren(
  workspaceRoot: string,
  element: TasksArtifactTreeItem,
): Promise<TaskTreeItem[]> {
  const tasks = await readTaskChecklist(workspaceRoot, element.changeName, element.archived);
  return tasks.map(
    (task) =>
      new TaskTreeItem(element.changeName, element.changeDir, element.archived, task.lineNumber, task.text, task.done),
  );
}

export class ChangesTreeProvider implements vscode.TreeDataProvider<WorkbenchTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly workspaceRoot: string) { }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: WorkbenchTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkbenchTreeItem): Promise<WorkbenchTreeItem[]> {
    if (element instanceof ChangeTreeItem) {
      return getChangeChildren(element);
    }
    if (element instanceof TasksArtifactTreeItem) {
      return getTasksArtifactChildren(this.workspaceRoot, element);
    }
    if (element instanceof RepoBootstrapRootTreeItem) {
      return getRepoBootstrapActions();
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
    items.push(new RepoBootstrapRootTreeItem());
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
