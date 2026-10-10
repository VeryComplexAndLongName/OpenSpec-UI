import { stat } from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  AGENT_REGISTRY,
  CHECK_SCRIPT_NAMES,
  readGlobalHarnessConfig,
  type DetectedAgent,
  type HarnessConfig,
} from "@openspec-ui/core";
import { readRepoSetupFacts } from "../repo-setup-facts.js";
import {
  ArtifactTreeItem,
  getRepoBootstrapActions,
  HarnessSettingsRootTreeItem,
  RepoBootstrapActionTreeItem,
  RepoBootstrapRootTreeItem,
} from "./changes-tree.js";

// The Workspace view: what is about the workspace rather than one change -
// the Pipeline and the Dashboard, the workspace's harness and its agents,
// OpenSpec's configuration, the repository's setup and its checks (ADR
// 0044, the-side-panel-is-the-workspace). A change is worked on its card.

/** A row that runs one command. Its icon is the command's own, as the
 * manifest gives it (ADR 0045). */
export class WorkspaceCommandTreeItem extends vscode.TreeItem {
  constructor(label: string, command: string, icon: string, description?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.id = `workspace-command:${command}`;
    if (description !== undefined) this.description = description;
    this.contextValue = "openspec-ui.workspaceCommand";
    this.iconPath = new vscode.ThemeIcon(icon);
    this.command = { command, title: label };
  }
}

/** The agents this machine has, read when the row is opened. */
export class AgentsRootTreeItem extends vscode.TreeItem {
  constructor() {
    super("Agents", vscode.TreeItemCollapsibleState.Collapsed);
    this.id = "workspace-agents";
    this.description = "found here, and the stages they run";
    this.contextValue = "openspec-ui.agentsRoot";
    this.iconPath = new vscode.ThemeIcon("hubot");
  }
}

/** One agent: whether it is here, its version, and the stages the
 * workspace harness gives it. */
export class AgentTreeItem extends vscode.TreeItem {
  constructor(public readonly agentId: string, label: string, detected: DetectedAgent, stages: readonly string[]) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.id = `workspace-agent:${agentId}`;
    this.description = describeAgent(detected, stages);
    this.tooltip = `${agentId}: ${this.description}`;
    this.contextValue = detected.detected ? "openspec-ui.agent" : "openspec-ui.agent.missing";
    this.iconPath = new vscode.ThemeIcon(
      detected.detected ? "pass" : "circle-slash",
      detected.detected ? undefined : new vscode.ThemeColor("disabledForeground"),
    );
  }
}

/** What an agent's row says: "found 1.2.3 - apply, verify", "not found". */
export function describeAgent(detected: DetectedAgent, stages: readonly string[]): string {
  const presence = detected.detected
    ? detected.version !== undefined ? `found ${detected.version}` : "found"
    : "not found";
  return stages.length > 0 ? `${presence} - ${stages.join(", ")}` : presence;
}

/** The stages the workspace harness gives each agent, by its id. */
export function stagesByAgent(config: Pick<HarnessConfig, "stepAgents"> | undefined): Map<string, string[]> {
  const stages = new Map<string, string[]>();
  for (const [stage, step] of Object.entries(config?.stepAgents ?? {})) {
    // An entry is the agent's id, or an object naming it.
    const agent = typeof step === "string" ? step : step?.agent;
    if (agent === undefined) continue;
    stages.set(agent, [...(stages.get(agent) ?? []), stage]);
  }
  return stages;
}

const CHECK_ROWS: Record<(typeof CHECK_SCRIPT_NAMES)[number], { label: string; command: string; icon: string }> = {
  typecheck: { label: "Run Typecheck", command: "openspec-ui.runTypecheck", icon: "check" },
  test: { label: "Run Tests", command: "openspec-ui.runTests", icon: "beaker" },
  lint: { label: "Run Lint", command: "openspec-ui.runLint", icon: "symbol-ruler" },
};

export type WorkspaceTreeItem =
  | WorkspaceCommandTreeItem
  | HarnessSettingsRootTreeItem
  | AgentsRootTreeItem
  | AgentTreeItem
  | ArtifactTreeItem
  | RepoBootstrapRootTreeItem
  | RepoBootstrapActionTreeItem;

export interface WorkspaceTreeDeps {
  /** Which agents are here: the editor's own detection, with the local LLM
   * looked for where the settings say. */
  detectAgents: () => Promise<Record<string, DetectedAgent>>;
  /** The workspace harness, or `undefined` where it cannot be read. */
  readHarness?: (workspaceRoot: string) => Promise<HarnessConfig | undefined>;
}

export class WorkspaceTreeProvider implements vscode.TreeDataProvider<WorkspaceTreeItem> {
  private readonly changed = new vscode.EventEmitter<WorkspaceTreeItem | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  /** The checks this workspace declares, as the check contexts resolve
   * them: a row for each, and none for a check it does not declare. */
  private checks: Partial<Record<(typeof CHECK_SCRIPT_NAMES)[number], unknown>> = {};
  /** Read once a person opens Agents, and again on Refresh Views: each
   * detection starts the agents' CLIs. */
  private agents: Promise<Record<string, DetectedAgent>> | undefined;

  constructor(private readonly workspaceRoot: string, private readonly deps: WorkspaceTreeDeps) {}

  refresh(): void {
    this.agents = undefined;
    this.changed.fire(undefined);
  }

  setChecks(resolved: Partial<Record<(typeof CHECK_SCRIPT_NAMES)[number], unknown>>): void {
    this.checks = resolved;
    this.changed.fire(undefined);
  }

  getTreeItem(element: WorkspaceTreeItem): vscode.TreeItem {
    return element;
  }

  getParent(element: WorkspaceTreeItem): WorkspaceTreeItem | undefined {
    if (element instanceof AgentTreeItem) return new AgentsRootTreeItem();
    if (element instanceof RepoBootstrapActionTreeItem) return new RepoBootstrapRootTreeItem();
    return undefined;
  }

  async getChildren(element?: WorkspaceTreeItem): Promise<WorkspaceTreeItem[]> {
    if (element instanceof AgentsRootTreeItem) return this.agentRows();
    if (element instanceof RepoBootstrapRootTreeItem) {
      // Read only when the section is opened, and cached for the session.
      return getRepoBootstrapActions(await readRepoSetupFacts(this.workspaceRoot));
    }
    if (element) return [];
    const configPath = path.join(this.workspaceRoot, "openspec", "config.yaml");
    const configExists = await stat(configPath).then((found) => found.isFile(), () => false);
    const rows: WorkspaceTreeItem[] = [
      new WorkspaceCommandTreeItem("Open Pipeline", "openspec-ui.openPipeline", "type-hierarchy", "every change, on its card"),
      new WorkspaceCommandTreeItem("Open Dashboard", "openspec-ui.openDashboard", "dashboard"),
      new HarnessSettingsRootTreeItem(),
      new AgentsRootTreeItem(),
      new ArtifactTreeItem("OpenSpec Configuration", configPath, configExists, "openspec-ui.config"),
      new RepoBootstrapRootTreeItem(),
    ];
    for (const name of CHECK_SCRIPT_NAMES) {
      if (!this.checks[name]) continue;
      const check = CHECK_ROWS[name];
      rows.push(new WorkspaceCommandTreeItem(check.label, check.command, check.icon));
    }
    return rows;
  }

  private async agentRows(): Promise<AgentTreeItem[]> {
    this.agents ??= this.deps.detectAgents();
    const [detected, harness] = await Promise.all([
      this.agents,
      (this.deps.readHarness ?? readWorkspaceHarness)(this.workspaceRoot),
    ]);
    const stages = stagesByAgent(harness);
    return AGENT_REGISTRY.map((agent) => new AgentTreeItem(
      agent.id,
      agent.label,
      detected[agent.id] ?? { detected: false },
      stages.get(agent.id) ?? [],
    ));
  }
}

async function readWorkspaceHarness(workspaceRoot: string): Promise<HarnessConfig | undefined> {
  try {
    return await readGlobalHarnessConfig(workspaceRoot);
  } catch {
    return undefined;
  }
}
