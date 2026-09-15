import * as vscode from "vscode";
import {
  applicableRepoSetupActionIds,
  describeChangeState,
  discoverOpenSpecWorkspace,
  readChangeStandings,
  readTaskChecklist,
  STANDING_FETCH_INTERVAL_MS,
  type ChangeState,
  type DescribedChangeState,
  type RepoSetupActionId,
  type RepoSetupFacts,
  type WorkbenchArtifact,
} from "@openspec-ui/core";
import { readRepoSetupFacts } from "../repo-setup-facts.js";
import { changeUri, type ChangeStandingDecorations } from "./change-standing-decorations.js";

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
    /** Where the change stands across the repository, where it has been
     * read (a-change-says-where-it-stands). */
    public readonly standing?: DescribedChangeState,
    /** The OpenSpec schema its artifacts were read from; a fallback puts a
     * warning row first (a-change-lists-what-its-schema-declares). */
    public readonly schema?: { name: string; fallback?: { reason: string; detail: string } },
  ) {
    super(changeName, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = `change:${archived ? "archived" : "active"}:${changeName}`;
    this.description = standing ? `${state} — ${standing.word}` : state;
    if (!archived) this.resourceUri = changeUri(changeName);
    if (standing) {
      this.tooltip = [standing.word, ...standing.lines.map((line) => `${line.text} (${line.source})`)].join("\n");
    }
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
    // Undefined for the root-level "OpenSpec Configuration" artifact, which
    // has no owning change. Set whenever this artifact was reached through
    // `getChangeChildren` below, so `getParent` can resolve back to it.
    public readonly changeName?: string,
    public readonly changeDir?: string,
    public readonly archived?: boolean,
    // The row this one was built under, kept so `getParent` can return
    // it rather than assemble a second answer. See
    // a-restored-row-says-what-it-is.
    public readonly parent?: ChangeTreeItem,
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
    public readonly parent?: ChangeTreeItem,
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

/** Every setup action this tree can show, keyed by the id the core rule
 * decides on. The rule says WHICH apply; this says what each looks
 * like, which is the host's half of it. */
const REPO_BOOTSTRAP_ACTIONS: Record<
  RepoSetupActionId,
  { label: string; description: string; command: string; icon: string }
> = {
  "generate-agent-instructions": {
    label: "Generate Agent Instructions",
    description: "CLAUDE.md / AGENTS.md",
    command: "openspec-ui.generateAgentInstructions",
    icon: "book",
  },
  "configure-dependabot": {
    label: "Configure Dependabot",
    description: ".github/dependabot.yml",
    command: "openspec-ui.configureDependabot",
    icon: "shield",
  },
  "generate-subtype-instructions": {
    label: "Generate Path-Scoped Copilot Instructions",
    description: ".github/instructions/<subtype>.instructions.md",
    command: "openspec-ui.generateSubtypeInstructions",
    icon: "file-code",
  },
};

/** Only the actions that can do something here — see
 * setup-offers-only-what-applies. An action that is not listed is still
 * invocable from the Command Palette, where it says why it is not
 * listed and offers to proceed; that is the escape hatch for a GitHub
 * Enterprise host, which no URL check can recognise.
 *
 * `facts` is passed in rather than read here so the rule and the
 * rendering can both be tested without an editor. */
export function getRepoBootstrapActions(facts: RepoSetupFacts = {}): RepoBootstrapActionTreeItem[] {
  return applicableRepoSetupActionIds(facts).map((id) => {
    const action = REPO_BOOTSTRAP_ACTIONS[id];
    return new RepoBootstrapActionTreeItem(action.label, action.description, action.command, action.icon);
  });
}

/** A single, direct action — unlike Repository Setup (three actions), the
 * global harness config has exactly one: open (creating with the
 * documented default if missing) `openspec/agent-harness.json`. See
 * openspec/changes/agentic-harness/. */
export class HarnessSettingsRootTreeItem extends vscode.TreeItem {
  constructor() {
    super("Harness Settings", vscode.TreeItemCollapsibleState.None);
    this.id = "harness-settings-root";
    this.description = "openspec/agent-harness.json";
    this.contextValue = "openspec-ui.harnessSettingsRoot";
    this.iconPath = new vscode.ThemeIcon("robot");
    this.command = { command: "openspec-ui.configureHarness", title: "Harness Settings" };
  }
}

/** The first row under a change whose OpenSpec schema could not be read:
 * the artifacts that follow are the built-in `spec-driven` ones, and this
 * says why (a-change-lists-what-its-schema-declares, ADR 0031). Its id is
 * tied to the change, so two changes naming the same missing schema never
 * share one. */
export class SchemaFallbackTreeItem extends vscode.TreeItem {
  constructor(
    public readonly parent: ChangeTreeItem,
    schemaName: string,
    fallback: { reason: string; detail: string },
  ) {
    super(`Schema: ${schemaName}`, vscode.TreeItemCollapsibleState.None);
    this.id = `schema-fallback:${parent.archived ? "archived" : "active"}:${parent.changeName}`;
    this.description = fallback.reason === "not-found"
      ? "not found — showing spec-driven artifacts"
      : fallback.reason === "no-artifacts"
        ? "declares no artifacts — showing spec-driven artifacts"
        : "unreadable — showing spec-driven artifacts";
    this.tooltip = fallback.detail;
    this.contextValue = "openspec-ui.schemaFallback";
    this.iconPath = new vscode.ThemeIcon("warning");
  }
}

export type WorkbenchTreeItem =
  | ChangeTreeItem
  | ArtifactTreeItem
  | TasksArtifactTreeItem
  | SchemaFallbackTreeItem
  | EmptyTreeItem
  | TaskTreeItem
  | RepoBootstrapRootTreeItem
  | RepoBootstrapActionTreeItem
  | HarnessSettingsRootTreeItem;

/** Shared by `ChangesTreeProvider` and `ArchiveTreeProvider` — both trees
 * expand a `ChangeTreeItem` the same way: its artifacts, with the
 * `tasks.md` artifact rendered as a `TasksArtifactTreeItem` so its
 * checklist items nest under *it*, not flat alongside Proposal/Design/
 * Spec. See openspec/changes/nest-tasks-under-tasks-artifact/design.md. */
export function getChangeChildren(element: ChangeTreeItem): WorkbenchTreeItem[] {
  const fallback = element.schema?.fallback;
  const schemaRow: WorkbenchTreeItem[] = fallback && element.schema
    ? [new SchemaFallbackTreeItem(element, element.schema.name, fallback)]
    : [];
  return [...schemaRow, ...element.artifacts.map((artifact): WorkbenchTreeItem => {
    if (artifact.kind === "tasks") {
      return new TasksArtifactTreeItem(
        artifact.label,
        artifact.path,
        artifact.exists,
        element.changeName,
        element.changeDir,
        element.archived,
        element,
      );
    }
    return new ArtifactTreeItem(
      artifact.kind === "delta-spec" ? `Spec: ${artifact.label}` : artifact.label,
      artifact.path,
      artifact.exists,
      "openspec-ui.artifact",
      element.changeName,
      element.changeDir,
      element.archived,
      element,
    );
  })];
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

/** `TreeView.reveal` needs this on both `ChangesTreeProvider` and
 * `ArchiveTreeProvider` — they nest the same way (change → artifact →
 * task), so one implementation covers both. Only a change is ever what
 * `reveal` is called with (design.md, "what getParent has to return"),
 * but an artifact resolves to its change too, since that costs nothing
 * once `ArtifactTreeItem`/`TasksArtifactTreeItem` already carry it.
 *
 * Returns the very row `getChildren` handed out, carried on the child
 * since it was built. It used to rebuild one and write `"draft"` in as
 * the state, on the grounds that `reveal`'s matching reads only `.id` —
 * true, and beside the point: `getTreeItem` hands this object straight
 * back, so VS Code *draws* it, and `ChangeTreeItem`'s description is its
 * state. A window reload restores the tree's selection through this
 * chain, which is how a change with every task done came to read
 * `draft`. See a-restored-row-says-what-it-is.
 *
 * No parent carried means no parent: the workspace-level artifact
 * belongs to no change, and a row assembled from defaults is the thing
 * that went wrong. */
export function getWorkbenchParent(element: WorkbenchTreeItem): WorkbenchTreeItem | undefined {
  if (element instanceof ChangeTreeItem) return undefined;
  if (
    element instanceof ArtifactTreeItem
    || element instanceof TasksArtifactTreeItem
    || element instanceof SchemaFallbackTreeItem
  ) {
    return element.parent;
  }
  return undefined;
}

/** How a reading of standings fetches refs: now, or only where they are
 * older than the fetch interval. */
export type StandingFetchMode = "now" | "interval";

export interface ChangesTreeOptions {
  /** Where each change stands, as its state word. Test seam; production reads
   * core's standings. */
  readStates?: (workspaceRoot: string, fetch: StandingFetchMode) => Promise<ReadonlyMap<string, DescribedChangeState>>;
  /** Given each reading, so the rows' colours agree with their words. */
  decorations?: Pick<ChangeStandingDecorations, "update">;
}

async function readStatesFromCore(workspaceRoot: string, fetch: StandingFetchMode): Promise<ReadonlyMap<string, DescribedChangeState>> {
  const reading = await readChangeStandings(workspaceRoot, {
    fetch: fetch === "now" ? "now" : { ifOlderThan: STANDING_FETCH_INTERVAL_MS },
  });
  return new Map(reading.standings.map((standing) => [standing.changeName, describeChangeState({ standing })]));
}

export class ChangesTreeProvider implements vscode.TreeDataProvider<WorkbenchTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  /** The words last read. The tree draws with these at once, and draws again
   * when a new reading lands, so a fetch never holds the tree back. */
  private states: ReadonlyMap<string, DescribedChangeState> | undefined;
  private stale = true;
  private fetchNext: StandingFetchMode = "interval";
  private reading: Promise<void> | undefined;
  private queued: StandingFetchMode | undefined;

  constructor(private readonly workspaceRoot: string, private readonly options: ChangesTreeOptions = {}) { }

  /** Draws the tree again and reads standings again. `fetchNow` fetches refs
   * at once, whatever the interval: the view's Refresh. */
  refresh(options: { fetchNow?: boolean } = {}): void {
    this.stale = true;
    if (options.fetchNow) this.fetchNext = "now";
    this.onDidChangeTreeDataEmitter.fire();
  }

  /** One reading at a time. A reading asked for while one is under way runs
   * after it, and a fetch asked for is never dropped. */
  private readStates(fetch: StandingFetchMode): void {
    if (this.reading !== undefined) {
      this.queued = this.queued === "now" || fetch === "now" ? "now" : "interval";
      return;
    }
    this.reading = (this.options.readStates ?? readStatesFromCore)(this.workspaceRoot, fetch)
      .then((states) => {
        this.states = states;
        this.options.decorations?.update(states);
        this.onDidChangeTreeDataEmitter.fire();
      })
      // Best-effort: a tree whose standings cannot be read lists every change
      // as it always has.
      .catch(() => undefined)
      .finally(() => {
        this.reading = undefined;
        const next = this.queued;
        this.queued = undefined;
        if (next !== undefined) this.readStates(next);
      });
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
    if (element instanceof RepoBootstrapRootTreeItem) {
      // Detection happens here and nowhere else: this branch is reached
      // only when the section is expanded, and the facts are cached for
      // the session so a tree refresh — which happens on every
      // workspace change — spawns nothing.
      return getRepoBootstrapActions(await readRepoSetupFacts(this.workspaceRoot));
    }

    if (element) return [];
    if (this.stale) {
      this.stale = false;
      const fetch = this.fetchNext;
      this.fetchNext = "interval";
      this.readStates(fetch);
    }
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
    items.push(new HarnessSettingsRootTreeItem());
    for (const change of workspace.changes) {
      items.push(new ChangeTreeItem(
        change.name,
        change.path,
        change.state,
        change.artifacts,
        false,
        this.states?.get(change.name),
        change.schema,
      ));
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
