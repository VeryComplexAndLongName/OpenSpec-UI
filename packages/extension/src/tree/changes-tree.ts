import * as vscode from "vscode";
import {
  applicableRepoSetupActionIds,
  describeChangeState,
  discoverOpenSpecWorkspace,
  readChangeReadiness,
  changeOwnerships,
  changesOnlyElsewhere,
  describeChangesOnlyElsewhere,
  describeOwnership,
  isOursToWrite,
  ownChangeOf,
  readChangeStandings,
  readTaskChecklist,
  refreshSurveyRuns,
  STANDING_FETCH_INTERVAL_MS,
  surveyWorktrees,
  withSurveyedRuns,
  type ChangeOwnership,
  type ChangeReadinessReport,
  type ChangeStandings,
  type ChangeState,
  type DescribedChangeState,
  type RepoSetupActionId,
  type RepoSetupFacts,
  type WorkbenchArtifact,
  type WorktreeSurvey,
} from "@openspec-ui/core";
import { readRepoSetupFacts } from "../repo-setup-facts.js";
import { changeUri, standingThemeColour, type ChangeStandingDecorations } from "./change-standing-decorations.js";

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
    /** Whose change this is, where the survey has been taken
     * (changes-shows-one-change-and-who-owns-it). */
    public readonly ownership: ChangeOwnership = { kind: "nobody" },
  ) {
    super(changeName, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = `change:${archived ? "archived" : "active"}:${changeName}`;
    const whose = archived ? undefined : describeOwnership(ownership);
    const stands = standing ? `${state} — ${standing.word}` : state;
    this.description = whose === undefined ? stands : `${stands} - ${whose}`;
    if (!archived) this.resourceUri = changeUri(changeName);
    const lines = standing
      ? [standing.word, ...standing.lines.map((line) => `${line.text} (${line.source})`)]
      : [];
    if (whose !== undefined) lines.push(whose);
    if (lines.length > 0) this.tooltip = lines.join("\n");
    // A row worked in another working directory takes a context value of
    // its own, so the menu items that would write to it are not offered.
    // Reading it, and speaking to the run in it, still are: the channel is
    // how two agents are meant to coordinate (ADR 0028).
    this.contextValue = archived
      ? "openspec-ui.archivedChange"
      : isOursToWrite(ownership) ? "openspec-ui.activeChange" : "openspec-ui.activeChange.elsewhere";
    // The standing's colour rides the icon, and the label keeps the theme's
    // own foreground: a decoration's colour would tint the words, and a
    // dozen coloured rows read as if the colour were the subject
    // (the-icon-carries-the-colour).
    // Ownership takes the icon's shape and the standing keeps its colour:
    // one channel each (the-icon-carries-the-colour). Another directory's
    // copy is greyed because this checkout's copy of it is a snapshot from
    // when their branch was cut, so a colour here would be about the past.
    if (!archived && !isOursToWrite(ownership)) {
      this.iconPath = new vscode.ThemeIcon("lock", new vscode.ThemeColor("disabledForeground"));
    } else {
      const colour = standing === undefined ? undefined : standingThemeColour(standing.colour);
      this.iconPath = new vscode.ThemeIcon(iconForState(state), colour);
    }
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
    // A spec file OpenSpec's archive drops, as core decides
    // (an-artifact-label-says-what-it-is).
    notAppliedOnArchive = false,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.id = `artifact:${artifactPath}`;
    const dropped = exists && notAppliedOnArchive;
    this.description = !exists ? "missing" : dropped ? "not applied on archive" : undefined;
    if (dropped) {
      this.tooltip = "OpenSpec archive applies only specs/<capability>/spec.md, so this file is not merged into openspec/specs.";
    }
    this.contextValue = contextValue;
    this.iconPath = new vscode.ThemeIcon(exists && !dropped ? "markdown" : "warning");
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

/** What the sweep cleared, said once and then only while it is news.
 * A directory that went without being asked for is stated rather than
 * left to be noticed (the-workspace-clears-what-it-left-behind). */
export class LeftoversClearedTreeItem extends vscode.TreeItem {
  constructor(public readonly names: string[]) {
    super(
      names.length === 1
        ? `Cleared 1 directory the archive left behind`
        : `Cleared ${names.length} directories the archive left behind`,
      vscode.TreeItemCollapsibleState.None,
    );
    this.id = "leftovers-cleared";
    this.description = names.join(", ");
    this.tooltip = `Each held only files this product wrote, and its change is archived: ${names.join(", ")}`;
    this.contextValue = "openspec-ui.leftoversCleared";
    this.iconPath = new vscode.ThemeIcon("check");
  }
}

/** A directory with no documents that the product will not clear by
 * itself: it holds something the product did not write, or nothing of its
 * name is archived. Shown with what it holds, and offering the removal as
 * a press. */
export class LeftoverTreeItem extends vscode.TreeItem {
  constructor(
    public readonly leftoverName: string,
    public readonly leftoverPath: string,
    files: string[],
    archived: boolean,
  ) {
    super(leftoverName, vscode.TreeItemCollapsibleState.None);
    this.id = `leftover:${leftoverName}`;
    this.description = files.length === 0 ? "empty directory" : files.join(", ");
    this.tooltip = archived
      ? "No document in it, and it holds a file this product did not write"
      : "No document in it, and no change of this name is archived - it may be a change you have not written yet";
    this.contextValue = "openspec-ui.leftover";
    this.iconPath = new vscode.ThemeIcon("question");
    this.resourceUri = vscode.Uri.file(leftoverPath);
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
  | HarnessSettingsRootTreeItem
  | LeftoversClearedTreeItem
  | LeftoverTreeItem;

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
      artifact.notAppliedOnArchive === true,
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

/** One reading of where each change stands, with the survey of working
 * directories it was read from, so the runs can later be read again over
 * that survey alone (the-changes-views-see-a-run-start). */
export interface StandingsReading {
  standings: ChangeStandings;
  survey: WorktreeSurvey;
  /** What readiness says about each change, so a row can say it is
   * blocked. Absent where the reading failed: a tree that lost its words
   * over this would be worse than one that says Ready
   * (a-blocked-change-says-so-where-it-is-listed). */
  readiness?: ChangeReadinessReport;
}

export interface ChangesTreeOptions {
  /** Where each change stands, and the survey the reading took. Test seam;
   * production reads core's standings. */
  readStandings?: (workspaceRoot: string, fetch: StandingFetchMode) => Promise<StandingsReading>;
  /** `survey` with its runs read again from the status records, without git.
   * Test seam; production calls core's `refreshSurveyRuns`. */
  readRuns?: (survey: WorktreeSurvey) => Promise<WorktreeSurvey>;
  /** Given each reading, so the rows' colours agree with their words. */
  decorations?: Pick<ChangeStandingDecorations, "update">;
}

async function readStandingsFromCore(workspaceRoot: string, fetch: StandingFetchMode): Promise<StandingsReading> {
  // The survey the reading takes is kept, so a status record's event can lay
  // fresh runs over it without listing git worktrees again.
  let survey: WorktreeSurvey | undefined;
  const standings = await readChangeStandings(workspaceRoot, {
    fetch: fetch === "now" ? "now" : { ifOlderThan: STANDING_FETCH_INTERVAL_MS },
    survey: async (root) => (survey = await surveyWorktrees({ workspaceRoot: root })),
  });
  if (survey === undefined) throw new Error("the standings were read without a survey");
  // Read beside the standings, and its failure is its own: the Change
  // Graph and the command line have always read this, and the tree said
  // Ready for every change that was not finished until it did too.
  const readiness = await readChangeReadiness({ workspaceRoot }).catch(() => undefined);
  return { standings, survey, ...(readiness ? { readiness } : {}) };
}

/** Records are not swept here: a tree reading removes no files. */
function readRunsFromCore(survey: WorktreeSurvey): Promise<WorktreeSurvey> {
  return refreshSurveyRuns(survey);
}

/** Each change's word, from its standing with the survey's runs laid over
 * it, as a Pipeline card lays them. */
function describeReading(reading: StandingsReading): ReadonlyMap<string, DescribedChangeState> {
  const readinessOf = new Map((reading.readiness?.changes ?? []).map((change) => [change.changeName, change]));
  return new Map(reading.standings.standings.map((standing) => {
    const read = readinessOf.get(standing.changeName);
    return [
      standing.changeName,
      describeChangeState({
        standing: withSurveyedRuns(standing, reading.survey),
        ...(read ? { readiness: read.run.state, blockers: read.blockers } : {}),
      }),
    ];
  }));
}

/** Whether two readings say the same for every change: its word, colour,
 * badge and lines. The states are plain data, in the reading's order. */
function sameStates(left: ReadonlyMap<string, DescribedChangeState>, right: ReadonlyMap<string, DescribedChangeState>): boolean {
  return JSON.stringify([...left]) === JSON.stringify([...right]);
}

/** This working directory's own change first: the view is about it. The
 * rest keep the order they were discovered in, so a list does not
 * reshuffle as records come and go. */
function orderedByOwner<T extends { name: string }>(
  changes: readonly T[],
  ownerships: ReadonlyMap<string, ChangeOwnership>,
): T[] {
  const rank = (name: string): number => {
    switch (ownerships.get(name)?.kind) {
      case "here": return 0;
      case "nobody": return 1;
      default: return 2;
    }
  };
  return [...changes].sort((left, right) => rank(left.name) - rank(right.name));
}

export class ChangesTreeProvider implements vscode.TreeDataProvider<WorkbenchTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  /** The words last read. The tree draws with these at once, and draws again
   * when a new reading lands, so a fetch never holds the tree back. */
  private states: ReadonlyMap<string, DescribedChangeState> | undefined;
  /** The last standings reading, with the survey its runs were last laid
   * from. */
  private held: StandingsReading | undefined;
  private stale = true;
  private fetchNext: StandingFetchMode = "interval";
  private reading: Promise<void> | undefined;
  private queued: StandingFetchMode | undefined;
  private runsReading: Promise<void> | undefined;
  private runsQueued = false;
  private recordsChangedDuringReading = false;
  /** What the last sweep cleared and what it left where it is. Set by the
   * host, which runs the sweep; the view only says what happened
   * (the-workspace-clears-what-it-left-behind). */
  private leftovers: { cleared: string[]; kept: Array<{ name: string; path: string; files: string[]; archived: boolean }> } = {
    cleared: [],
    kept: [],
  };

  constructor(private readonly workspaceRoot: string, private readonly options: ChangesTreeOptions = {}) { }

  /** What the sweep found, for the rows above the changes. Drawing
   * follows, since a directory that went while the view was open should
   * not wait for the next file event to be said. */
  setLeftovers(reading: {
    cleared: string[];
    kept: Array<{ name: string; path: string; files: string[]; archived: boolean }>;
  }): void {
    this.leftovers = reading;
    this.onDidChangeTreeDataEmitter.fire();
  }

  /** The change this working directory is for, where the survey says it
   * is one change's worktree (ADR 0022). The view puts it in its own
   * description, so the window says what it is for before a row is read
   * (changes-shows-one-change-and-who-owns-it). */
  ownChangeName(): string | undefined {
    return ownChangeOf(this.held?.survey);
  }

  /** Draws the tree again and reads standings again. `fetchNow` fetches refs
   * at once, whatever the interval: the view's Refresh. */
  refresh(options: { fetchNow?: boolean } = {}): void {
    this.stale = true;
    if (options.fetchNow) this.fetchNext = "now";
    this.onDidChangeTreeDataEmitter.fire();
  }

  /** Reads which runs are live again, from the status records alone, over
   * the survey the last standings reading took: no git, no fetch, no `gh`.
   * The tree is drawn again only where a change's word, colour, badge or
   * lines changed, so a heartbeat's rewrite draws nothing. With no reading
   * held yet, reads standings (the-changes-views-see-a-run-start). */
  refreshRuns(): void {
    // A standings reading under way surveyed before this event, so its runs
    // may already be old when it lands.
    if (this.reading !== undefined) this.recordsChangedDuringReading = true;
    const held = this.held;
    if (held === undefined) {
      this.refresh();
      return;
    }
    if (this.runsReading !== undefined) {
      this.runsQueued = true;
      return;
    }
    this.runsReading = (this.options.readRuns ?? readRunsFromCore)(held.survey)
      .then((survey) => {
        // A standings reading landed meanwhile: lay the runs over that one
        // instead, on the next pass.
        if (this.held !== held) {
          this.runsQueued = true;
          return;
        }
        const reading = { standings: held.standings, survey };
        this.held = reading;
        const states = describeReading(reading);
        if (this.states !== undefined && sameStates(this.states, states)) return;
        this.show(states);
      })
      // Best-effort, as a standings reading is: the words stay as they were.
      .catch(() => undefined)
      .finally(() => {
        this.runsReading = undefined;
        if (this.runsQueued) {
          this.runsQueued = false;
          this.refreshRuns();
        }
      });
  }

  private show(states: ReadonlyMap<string, DescribedChangeState>): void {
    this.states = states;
    this.options.decorations?.update(states);
    this.onDidChangeTreeDataEmitter.fire();
  }

  /** One reading at a time. A reading asked for while one is under way runs
   * after it, and a fetch asked for is never dropped. */
  private readStates(fetch: StandingFetchMode): void {
    if (this.reading !== undefined) {
      this.queued = this.queued === "now" || fetch === "now" ? "now" : "interval";
      return;
    }
    this.recordsChangedDuringReading = false;
    this.reading = (this.options.readStandings ?? readStandingsFromCore)(this.workspaceRoot, fetch)
      .then((reading) => {
        this.held = reading;
        this.show(describeReading(reading));
      })
      // Best-effort: a tree whose standings cannot be read lists every change
      // as it always has.
      .catch(() => undefined)
      .finally(() => {
        this.reading = undefined;
        // A record changed after this reading surveyed: its runs are read
        // again, or a run that ended meanwhile would read as running until
        // the next event.
        const rereadRuns = this.recordsChangedDuringReading;
        this.recordsChangedDuringReading = false;
        const next = this.queued;
        this.queued = undefined;
        if (next !== undefined) this.readStates(next);
        else if (rereadRuns) this.refreshRuns();
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
    // Active changes only: this view lists no archived one, and reading the
    // archive on every file event was most of each redraw's cost
    // (the-pipeline-reads-each-workspace-once).
    const workspace = await discoverOpenSpecWorkspace(this.workspaceRoot, { changes: "active" });
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
    if (this.leftovers.cleared.length > 0) items.push(new LeftoversClearedTreeItem(this.leftovers.cleared));
    for (const kept of this.leftovers.kept) {
      items.push(new LeftoverTreeItem(kept.name, kept.path, kept.files, kept.archived));
    }
    // Whose each change is, from the survey the standings reading already
    // took: no extra git, no extra watcher
    // (changes-shows-one-change-and-who-owns-it).
    const survey = this.held?.survey;
    const ownerships = changeOwnerships(workspace.changes.map((change) => change.name), survey);
    for (const change of orderedByOwner(workspace.changes, ownerships)) {
      items.push(new ChangeTreeItem(
        change.name,
        change.path,
        change.state,
        change.artifacts,
        false,
        this.states?.get(change.name),
        change.schema,
        ownerships.get(change.name),
      ));
    }
    // Changes that exist only in another working directory: this checkout
    // was cut before they were proposed, so no row above can carry them.
    const onlyElsewhere = changesOnlyElsewhere(survey, new Set(workspace.changes.map((change) => change.name)));
    const line = describeChangesOnlyElsewhere(onlyElsewhere);
    if (line !== undefined) {
      items.push(new EmptyTreeItem(
        line,
        onlyElsewhere.map((found) => `${found.changeName} (${found.label})`).join(", "),
        { command: "openspec-ui.openPipeline", title: "Open the Pipeline" },
      ));
    }
    if (workspace.changes.length === 0) {
      items.push(workspace.initialized
        ? new EmptyTreeItem("No active changes in this checkout", "Create an OpenSpec change to begin")
        : new EmptyTreeItem(
          "Initialize OpenSpec",
          "Set up this workspace",
          { command: "openspec-ui.initialize", title: "Initialize OpenSpec" },
        ));
    }
    return items;
  }
}
