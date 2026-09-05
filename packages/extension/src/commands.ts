// 1.1 Registers Command Palette commands (`openspec.plan`/`implement`/
// `review`/`status`/`cancel`, contributed as `openspec-ui.*` — see
// package.json `contributes.commands`).

import path from "node:path";
import * as vscode from "vscode";
import {
  AGENT_REGISTRY,
  COPILOT_MIN_AI_CREDITS,
  DEFAULT_HARNESS_CONFIG,
  HARNESS_AGENT_CAPABILITIES,
  DEFAULT_STALE_TASK_THRESHOLD_DAYS,
  TASK_CHECKBOX_LINE_RE,
  VERIFIED_CLAUDE_CLI_VERSION,
  TaskListChangedError,
  TemplateAlreadyExistsError,
  UnknownProjectTemplateError,
  archiveChange,
  buildSprintReport,
  checkChangesetReminder,
  createChange,
  customizeTemplate,
  deleteChange,
  deleteProjectTemplate,
  deleteTaskLine,
  detectAvailableAgentsDetailed,
  discoverOpenSpecWorkspace,
  getChangeTimeline,
  getChangeTimelines,
  initOpenSpec,
  listBootstrapProjectTypes,
  listChanges,
  isHarnessStepAgentStage,
  listSpecs,
  normalizeStepAgent,
  stepAgentFor,
  readArchivedChangeTasksTemplate,
  readGlobalHarnessConfig,
  renderSprintReportPdf,
  renderTemplate,
  resolveHarnessConfig,
  resolveRunWithHarnessTarget,
  showChange,
  unarchiveChange,
  validateChange,
  writeAgentInstructions,
  writeChangeHarnessConfig,
  writeDependabotConfig,
  writeGlobalHarnessConfig,
  writeSubtypeInstructions,
  type AgentDescriptor,
  type DetectedAgent,
  type StartProcessOptions,
  type WorkbenchProcessScheduler,
  type ChangeTimeline,
  type Command,
  type HarnessAutonomyLevel,
  type HarnessConfig,
  type HarnessEffort,
  type HarnessReviewGateMode,
  type HarnessStage,
  type HarnessStepAgent,
  type OpenSpecShowResult,
  type OpenSpecValidateResult,
} from "@openspec-ui/core";
import type { RunController } from "./run-controller.js";
import { describeEvent } from "./describe-event.js";
import { openDiffAgainstHead } from "./native/diff.js";
import type { ChangeTreeItem, TaskTreeItem } from "./tree/changes-tree.js";
import type { TemplateTreeItem } from "./tree/templates-tree.js";
import type { ImplementationSessionManager } from "./implementation-sessions.js";
import type { AiPanelContext } from "./webview/ai-panel.js";
import { buildWorkbenchChatPrompt } from "./workbench-chat-prompt.js";
import { TimelineWebviewPanel } from "./webview/timeline-panel.js";

/** The part of a `vscode.TreeView` the item-scoped commands read: the
 * rows currently highlighted in it. Narrower than `TreeView` on purpose —
 * nothing here reveals, expands or disposes a view. */
export interface TreeSelectionView {
  readonly selection: readonly unknown[];
}

export interface CommandsDeps {
  getWorkspaceRoot: () => string | undefined;
  runController: RunController;
  outputChannel: vscode.OutputChannel;
  revealAiPanel: (context?: AiPanelContext) => void;
  refreshTrees: () => void;
  refreshTemplatesTree: () => void;
  scheduler: WorkbenchProcessScheduler;
  implementationSessions: ImplementationSessionManager;
  /** Undefined until a workspace is open — the three views only exist
   * once there is a workspace root to build them from. */
  changesView?: TreeSelectionView;
  archiveView?: TreeSelectionView;
  templatesView?: TreeSelectionView;
}

async function showCommandError(action: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await vscode.window.showErrorMessage(`OpenSpec UI: ${action} failed (${message}).`);
}

function warnNoWorkspace(): void {
  void vscode.window.showErrorMessage("OpenSpec UI: open a folder or workspace first.");
}

const TREE_LABELS: Record<"change" | "template" | "task", string> = {
  change: "Changes",
  template: "Templates",
  task: "Changes",
};

function warnNoTreeSelection(kind: "change" | "template" | "task"): void {
  void vscode.window.showWarningMessage(
    `OpenSpec UI: select a ${kind} in the ${TREE_LABELS[kind]} tree, or run this from its right-click menu.`,
  );
}

// Kind checks keyed on `contextValue` — the same discriminator
// package.json's menu `when` clauses use to decide which rows a command
// belongs on, so the selection fallback admits exactly the rows the
// right-click menu would have offered it on. A structural check would
// not: `TasksArtifactTreeItem` carries the same `changeName`/`archived`
// fields as `ChangeTreeItem`.
const CHANGE_CONTEXT_VALUES = new Set(["openspec-ui.activeChange", "openspec-ui.archivedChange"]);
const TASK_CONTEXT_VALUES = new Set([
  "openspec-ui.activeTask",
  "openspec-ui.activeTaskDone",
  "openspec-ui.archivedTask",
]);
const TEMPLATE_CONTEXT_VALUES = new Set(["openspec-ui.builtInTemplate", "openspec-ui.projectTemplate"]);

function contextValueOf(candidate: unknown): string | undefined {
  if (typeof candidate !== "object" || candidate === null) return undefined;
  const value = (candidate as { contextValue?: unknown }).contextValue;
  return typeof value === "string" ? value : undefined;
}

function isChangeTreeItem(candidate: unknown): candidate is ChangeTreeItem {
  return CHANGE_CONTEXT_VALUES.has(contextValueOf(candidate) ?? "");
}

function isTaskTreeItem(candidate: unknown): candidate is TaskTreeItem {
  return TASK_CONTEXT_VALUES.has(contextValueOf(candidate) ?? "");
}

function isTemplateTreeItem(candidate: unknown): candidate is TemplateTreeItem {
  return TEMPLATE_CONTEXT_VALUES.has(contextValueOf(candidate) ?? "");
}

/** The Command Palette invokes a command with no arguments; only the
 * tree's own right-click menu passes the clicked row. So an `item` that
 * did arrive always wins, and otherwise the row the user highlighted in
 * the owning view stands in for it. Only a lone selection of the
 * expected kind qualifies: with several rows highlighted, picking one
 * would be a choice the user never made, and these commands mutate the
 * repository. The state checks in each handler are unaffected — this
 * decides which item, never whether the command may run. */
function resolveTreeItem<T>(
  item: T | undefined,
  view: TreeSelectionView | undefined,
  isExpectedKind: (candidate: unknown) => candidate is T,
): T | undefined {
  if (item) return item;
  const selection = view?.selection;
  if (!selection || selection.length !== 1) return undefined;
  const [candidate] = selection;
  return isExpectedKind(candidate) ? candidate : undefined;
}

/** Best-effort, non-blocking nudge after a successful archive: if this
 * workspace has adopted Changesets but no changeset is currently pending,
 * offer to run `npx changeset` in an integrated terminal. Never surfaces an
 * error — a failed check silently does nothing, since it must not affect
 * the archive operation that already succeeded. */
async function remindAboutPendingChangeset(workspaceRoot: string): Promise<void> {
  try {
    const status = await checkChangesetReminder(workspaceRoot);
    if (!status.changesetsAdopted || status.pendingChangesetCount > 0) return;
    const action = await vscode.window.showInformationMessage(
      "OpenSpec UI: this repository uses Changesets, but no pending changeset was found. " +
      "If this change affects a published package's version or changelog, add one now.",
      "Run npx changeset",
      "Dismiss",
    );
    if (action !== "Run npx changeset") return;
    const terminal = vscode.window.createTerminal({ name: "OpenSpec UI: changeset", cwd: workspaceRoot });
    terminal.show(true);
    terminal.sendText("npx changeset", true);
  } catch {
    // Best-effort only — see the doc comment above.
  }
}

/** Dismissible suggestion, not a blocking follow-up dialog — see tasks.md
 * 1.5 and design.md, "Suggestion is dismissible, not a blocking follow-up
 * dialog". Only offered when there is no existing global config yet, so an
 * already-configured workspace is never re-prompted. */
async function suggestAgenticHarnessSetup(workspaceRoot: string): Promise<void> {
  const harnessConfigExists = await fileExists(
    vscode.Uri.file(path.join(workspaceRoot, "openspec", "agent-harness.json")),
  );
  if (harnessConfigExists) return;
  const action = await vscode.window.showInformationMessage(
    "OpenSpec UI: set up the Agentic Harness for this workspace now?",
    "Set Up Agentic Harness",
  );
  if (action === "Set Up Agentic Harness") {
    await vscode.commands.executeCommand("openspec-ui.setUpAgenticHarness");
  }
}

async function runTrackedProcess(
  sessions: ImplementationSessionManager,
  workspaceRoot: string,
  options: Omit<StartProcessOptions, "execute"> & { execute: () => Promise<string | void> },
): Promise<void> {
  const process = await sessions.run(workspaceRoot, options);
  if (process.state === "failed") throw new Error(process.error ?? `${process.operation} failed`);
}

// openspec-ui.createChangeTemplate's wizard — see openspec/changes/
// agentic-harness-change-template/design.md, "Sequential QuickPick
// wizard, not a single form" and "Cancelling mid-wizard discards the
// whole customization, not a partial file". `git` is deliberately not
// asked — see design.md, "Why git is not part of the wizard".
const INHERIT_PICK = "(inherit from global default)";
const HARNESS_TEMPLATE_STAGES: readonly HarnessStage[] = ["propose", "review", "apply", "verify", "archive"];

const AUTONOMY_LEVEL_PICKS: readonly vscode.QuickPickItem[] = [
  { label: INHERIT_PICK },
  {
    label: "assisted",
    description: "Recommended default",
    detail: "The Agent Selection picker pre-fills a suggestion; a human still explicitly starts every stage.",
  },
  {
    label: "semi-autonomous",
    detail: "Runs propose -> review -> apply -> verify -> archive as one chain, pausing at a checkpoint between each stage by default.",
  },
  {
    label: "autonomous",
    detail: "Same chain, no pause between stages. Only takes effect because it is set in this exact per-change file.",
  },
];

const REVIEW_GATE_PICKS: readonly vscode.QuickPickItem[] = [
  { label: INHERIT_PICK },
  { label: "human-required", description: "Default" },
  {
    label: "agent-sufficient",
    detail: "Currently a no-op — the git stepAgent's commit/push action does not exist yet.",
  },
];

/** Returns `undefined` if the wizard was cancelled at any step (the
 * caller discards everything collected so far, per design.md); otherwise
 * a `Partial<HarnessConfig>` containing only the fields the user actually
 * set away from "(inherit)"/the default — possibly empty, if every
 * question was left at inherit/default. */
async function promptHarnessCustomization(changeName: string): Promise<Partial<HarnessConfig> | undefined> {
  const NO_EFFORT_PICK = "(none)";
  const stepAgents: Partial<Record<HarnessStage, HarnessStepAgent>> = {};
  for (const stage of HARNESS_TEMPLATE_STAGES) {
    // `archive` stays part of the stage sequence this wizard walks (it is
    // a real stage — hiding it from HARNESS_TEMPLATE_STAGES would
    // misrepresent the chain), but it is mechanical and invokes no agent,
    // so it is never asked about — see harness-mechanical-checks
    // tasks.md 4.4, and the `git` precedent just above this loop.
    if (!isHarnessStepAgentStage(stage)) continue;
    const pick = await vscode.window.showQuickPick(
      [INHERIT_PICK, ...AGENT_REGISTRY.map((agent) => agent.label)],
      { title: `Agent for "${stage}" (${changeName})` },
    );
    if (pick === undefined) return undefined;
    if (pick === INHERIT_PICK) continue;
    const agent = AGENT_REGISTRY.find((candidate) => candidate.label === pick);
    if (!agent) continue;

    // Only offer effort/budget for an agent whose capabilities actually
    // accept them (task 5.3's "never offer a value the validator would
    // reject", applied to this wizard too) — see harness-step-agent.ts's
    // `HARNESS_AGENT_CAPABILITIES`, the single source of truth this and
    // the webui settings view both read.
    const capabilities = HARNESS_AGENT_CAPABILITIES[agent.id];
    let effort: HarnessEffort | undefined;
    if (capabilities?.effort && capabilities.effort.length > 0) {
      const effortPick = await vscode.window.showQuickPick([NO_EFFORT_PICK, ...capabilities.effort], {
        title: `Reasoning effort for "${stage}" / ${agent.label} (${changeName})`,
      });
      if (effortPick === undefined) return undefined;
      if (effortPick !== NO_EFFORT_PICK) effort = effortPick as HarnessEffort;
    }

    let maxCostUsd: number | undefined;
    let maxAiCredits: number | undefined;
    if (capabilities?.budgetField !== undefined) {
      const budgetLabel = capabilities.budgetField === "maxCostUsd" ? "max cost in USD" : `max AI credits (minimum ${COPILOT_MIN_AI_CREDITS})`;
      const budgetInput = await vscode.window.showInputBox({
        title: `Spending cap for "${stage}" / ${agent.label} (${changeName})`,
        prompt: `Leave empty for no cap. Enter a ${budgetLabel}.`,
        validateInput: (value) => {
          if (value.trim().length === 0) return undefined;
          const numeric = Number(value);
          if (!Number.isFinite(numeric) || numeric <= 0) return "Enter a positive number.";
          if (capabilities.budgetField === "maxAiCredits" && (!Number.isInteger(numeric) || numeric < COPILOT_MIN_AI_CREDITS)) {
            return `Enter a whole number of at least ${COPILOT_MIN_AI_CREDITS}.`;
          }
          return undefined;
        },
      });
      if (budgetInput === undefined) return undefined;
      if (budgetInput.trim().length > 0) {
        if (capabilities.budgetField === "maxCostUsd") maxCostUsd = Number(budgetInput);
        else maxAiCredits = Number(budgetInput);
      }
    }

    if (effort === undefined && maxCostUsd === undefined && maxAiCredits === undefined) {
      stepAgents[stage] = agent.id;
    } else {
      stepAgents[stage] = {
        agent: agent.id,
        ...(effort !== undefined && { effort }),
        ...((maxCostUsd !== undefined || maxAiCredits !== undefined) && {
          budget: { ...(maxCostUsd !== undefined && { maxCostUsd }), ...(maxAiCredits !== undefined && { maxAiCredits }) },
        }),
      };
    }
  }

  const autonomyPick = await vscode.window.showQuickPick(AUTONOMY_LEVEL_PICKS, {
    title: `Autonomy level (${changeName})`,
  });
  if (autonomyPick === undefined) return undefined;

  const reviewGatePick = await vscode.window.showQuickPick(REVIEW_GATE_PICKS, {
    title: `Review gate (${changeName})`,
  });
  if (reviewGatePick === undefined) return undefined;

  const config: Partial<HarnessConfig> = {};
  if (Object.keys(stepAgents).length > 0) config.stepAgents = stepAgents;
  if (autonomyPick.label !== INHERIT_PICK) config.autonomyLevel = autonomyPick.label as HarnessAutonomyLevel;
  if (reviewGatePick.label !== INHERIT_PICK) config.reviewGate = { mode: reviewGatePick.label as HarnessReviewGateMode };
  return config;
}

// openspec-ui.setUpAgenticHarness — the guided first-run flow for the
// *global* Agentic Harness default. See openspec/changes/agentic-harness-
// init-wizard/design.md: unlike promptHarnessCustomization above (which
// discards everything on Esc, since a partially-filled per-change override
// is ambiguous state), every question here writes directly and immediately
// to the global file via writeGlobalHarnessConfig ("Writes progressively,
// not once at the end") — cancelling (Esc) simply stops asking further
// questions, without discarding what was already written.
const CONTROL_STAGES: readonly HarnessStage[] = ["propose", "review", "archive"];
const SETUP_AUTONOMY_LEVELS: readonly HarnessAutonomyLevel[] = ["assisted", "semi-autonomous"];

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function currentAgentFor(stepAgents: HarnessConfig["stepAgents"], stage: HarnessStage): string | undefined {
  const entry = stepAgentFor(stepAgents, stage);
  return entry === undefined ? undefined : normalizeStepAgent(entry).agent;
}

/** `showQuickPick` has no real "preselected item" concept for a single
 * pick — putting the current value first in the list is this wizard's
 * stand-in, per design.md's "every question's QuickPick reads the current
 * resolved value first and shows it as the pre-selected/first item". */
function orderWithCurrentFirst<T extends { id: string }>(items: readonly T[], currentId: string | undefined): T[] {
  if (currentId === undefined) return [...items];
  return [...items].sort((a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : 0));
}

async function promptAgentForRole(
  title: string,
  detectedAgents: readonly AgentDescriptor[],
  currentId: string | undefined,
): Promise<string | undefined> {
  const items = orderWithCurrentFirst(detectedAgents, currentId).map((agent) => ({
    label: agent.label,
    description: agent.id === currentId ? "current" : undefined,
    id: agent.id,
  }));
  const pick = await vscode.window.showQuickPick(items, { title });
  return pick?.id;
}

/** `autonomous` is never in this list at all — see design.md, "`autonomous`
 * is not offered at all, not offered-then-rejected": offering a choice
 * `writeGlobalHarnessConfig` is guaranteed to reject is worse UX than not
 * offering it. */
async function promptAutonomyLevelForSetup(current: HarnessAutonomyLevel): Promise<HarnessAutonomyLevel | undefined> {
  const ordered = [...SETUP_AUTONOMY_LEVELS].sort((a, b) => (a === current ? -1 : b === current ? 1 : 0));
  const items = ordered.map((level) => ({ label: level, description: level === current ? "current" : undefined }));
  const pick = await vscode.window.showQuickPick(items, { title: "Autonomy level" });
  return pick?.label as HarnessAutonomyLevel | undefined;
}

/** Only ever triggered for the raw `claude-cli` id, never its `-acp`
 * sibling — see design.md, "scoped to claude-cli alone". Reads the version
 * `detectAvailableAgentsDetailed()` already captured this run; must not
 * spawn `claude --version` again (ADR 0017 decision 6, and this change's
 * own tasks.md 1.4 as corrected by agent-usage-accounting's task 7.1). */
function warnOnClaudeCliVersionMismatch(detected: Record<string, DetectedAgent>): void {
  const version = detected["claude-cli"]?.version;
  if (version === undefined || version === VERIFIED_CLAUDE_CLI_VERSION) return;
  void vscode.window.showWarningMessage(
    `OpenSpec UI: installed Claude CLI version ${version} differs from the version this project's ` +
    `claude-cli ACP translation layer was last verified against (${VERIFIED_CLAUDE_CLI_VERSION}). ` +
    "See docs/adr/0013-acp-agent-adapters.md.",
    "Continue anyway",
  );
}

async function offerGenerateAgentInstructions(workspaceRoot: string): Promise<void> {
  const claudeMdExists = await fileExists(vscode.Uri.file(path.join(workspaceRoot, "CLAUDE.md")));
  const agentsMdExists = await fileExists(vscode.Uri.file(path.join(workspaceRoot, "AGENTS.md")));
  if (claudeMdExists && agentsMdExists) return;

  const generate = await vscode.window.showQuickPick(["Yes", "No"], {
    title: "Generate CLAUDE.md / AGENTS.md now?",
  });
  if (generate !== "Yes") return;

  // Reuses openspec-ui.generateAgentInstructions's exact call verbatim —
  // see tasks.md 1.3.
  const picked = await vscode.window.showQuickPick(
    listBootstrapProjectTypes().map((type) => ({ label: type.label, id: type.id })),
    { title: "Generate Agent Instructions", placeHolder: "Select a project type" },
  );
  if (!picked) return;
  await writeAgentInstructions(workspaceRoot, picked.id);
}

async function runSetUpAgenticHarness(workspaceRoot: string): Promise<void> {
  const detected = await detectAvailableAgentsDetailed();
  const detectedAgents = AGENT_REGISTRY.filter((agent) => detected[agent.id]?.detected);

  if (detectedAgents.length === 0) {
    void vscode.window.showInformationMessage(
      "OpenSpec UI: no supported CLI agent was detected on this machine — skipping the control/apply agent " +
      "and autonomy-level questions.",
    );
    await offerGenerateAgentInstructions(workspaceRoot);
    return;
  }

  let current = await readGlobalHarnessConfig(workspaceRoot);

  const controlAgentId = await promptAgentForRole(
    "Control agent (propose / review / archive)",
    detectedAgents,
    currentAgentFor(current.stepAgents, "propose"),
  );
  if (controlAgentId === undefined) return;
  current = {
    ...current,
    stepAgents: Object.fromEntries([
      ...Object.entries(current.stepAgents),
      ...CONTROL_STAGES.map((stage) => [stage, controlAgentId] as const),
    ]) as HarnessConfig["stepAgents"],
  };
  await writeGlobalHarnessConfig(workspaceRoot, current);

  const applyAgentId = await promptAgentForRole("Apply agent", detectedAgents, currentAgentFor(current.stepAgents, "apply"));
  if (applyAgentId === undefined) return;
  current = { ...current, stepAgents: { ...current.stepAgents, apply: applyAgentId } };
  await writeGlobalHarnessConfig(workspaceRoot, current);

  const autonomyLevel = await promptAutonomyLevelForSetup(current.autonomyLevel);
  if (autonomyLevel === undefined) return;
  current = { ...current, autonomyLevel };
  await writeGlobalHarnessConfig(workspaceRoot, current);

  if (controlAgentId === "claude-cli" || applyAgentId === "claude-cli") {
    warnOnClaudeCliVersionMismatch(detected);
  }

  await offerGenerateAgentInstructions(workspaceRoot);
}

function formatShowMarkdown(result: OpenSpecShowResult): string {
  const lines: string[] = [];
  lines.push(`# Change: ${result.id}`);
  lines.push("");
  lines.push(`- **Title:** ${result.title}`);
  lines.push(`- **Deltas:** ${result.deltaCount}`);
  lines.push("");

  for (const [index, delta] of result.deltas.entries()) {
    lines.push(`## Delta ${index + 1}`);
    lines.push("");
    lines.push(`- **Spec:** ${delta.spec}`);
    lines.push(`- **Operation:** ${delta.operation}`);
    lines.push(`- **Description:** ${delta.description}`);

    const requirements = delta.requirements ?? (delta.requirement ? [delta.requirement] : []);
    if (requirements.length > 0) {
      lines.push("");
      lines.push("### Requirements");
      for (const [reqIndex, req] of requirements.entries()) {
        lines.push("");
        lines.push(`${reqIndex + 1}. ${req.text}`);
        for (const scenario of req.scenarios) {
          lines.push(`   - Scenario: ${scenario.rawText}`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function dashboardContext(workspaceRoot: string, changeDir?: string): AiPanelContext {
  return {
    cwd: workspaceRoot,
    changeDir: changeDir ?? path.join(workspaceRoot, "openspec", "changes"),
  };
}

function formatValidateMarkdown(changeName: string, result: OpenSpecValidateResult): string {
  const lines: string[] = [];
  lines.push(`# Validation: ${changeName}`);
  lines.push("");
  lines.push(`- **OpenSpec version:** ${result.version}`);
  lines.push(`- **Items:** ${result.summary.totals.items}`);
  lines.push(`- **Passed:** ${result.summary.totals.passed}`);
  lines.push(`- **Failed:** ${result.summary.totals.failed}`);
  lines.push("");

  for (const item of result.items) {
    lines.push(`## ${item.id} (${item.type})`);
    lines.push("");
    lines.push(`- **Valid:** ${item.valid ? "yes" : "no"}`);
    lines.push(`- **Duration:** ${item.durationMs} ms`);
    if (item.issues.length > 0) {
      lines.push("- **Issues:**");
      for (const issue of item.issues) {
        lines.push(`  - ${issue.message}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function formatOpenSpecViewSummaryMarkdown(
  workspaceRoot: string,
  changes: Awaited<ReturnType<typeof listChanges>>,
  specs: Awaited<ReturnType<typeof listSpecs>>,
): string {
  const lines: string[] = [];
  const recentChanges = [...changes.changes]
    .sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified))
    .slice(0, 8);

  lines.push("# OpenSpec view summary");
  lines.push("");
  lines.push(`- **Workspace:** ${workspaceRoot}`);
  lines.push(`- **Changes:** ${changes.changes.length}`);
  lines.push(`- **Specs:** ${specs.specs.length}`);
  lines.push("");

  if (changes.changes.length > 0) {
    lines.push("## Changes");
    lines.push("");
    lines.push("| Change | Status | Tasks | Last modified |");
    lines.push("|---|---|---:|---|");
    for (const change of recentChanges) {
      lines.push(
        `| ${change.name} | ${change.status} | ${change.completedTasks}/${change.totalTasks} | ${change.lastModified} |`,
      );
    }
    lines.push("");
  }

  if (specs.specs.length > 0) {
    lines.push("## Specs");
    lines.push("");
    lines.push("| Spec | Requirements |");
    lines.push("|---|---:|");
    for (const spec of specs.specs) {
      lines.push(`| ${spec.id} | ${spec.requirementCount} |`);
    }
    lines.push("");
  }

  lines.push("> This summary is a parsed, non-interactive companion for `openspec view`. Use the integrated terminal for the full interactive dashboard.");
  return lines.join("\n");
}

/** Best-effort: if `tasks.md` changed since the tree was last refreshed,
 * the stored line number may no longer point at the right task — falls
 * back to a whole-document search by text, then to line 0, rather than
 * failing (reveal is read-only, unlike delete — see
 * openspec/changes/tasks-tree-expand/design.md). */
function resolveTaskLine(document: vscode.TextDocument, lineNumber: number, expectedText: string): number {
  if (lineNumber < document.lineCount) {
    const match = document.lineAt(lineNumber).text.match(TASK_CHECKBOX_LINE_RE);
    if (match && (match[2] ?? "").trim() === expectedText) return lineNumber;
  }
  for (let i = 0; i < document.lineCount; i += 1) {
    const match = document.lineAt(i).text.match(TASK_CHECKBOX_LINE_RE);
    if (match && (match[2] ?? "").trim() === expectedText) return i;
  }
  return 0;
}

async function openMarkdownDocument(title: string, markdown: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({ language: "markdown", content: markdown });
  await vscode.window.showTextDocument(doc, { preview: false });
  void vscode.window.showInformationMessage(`OpenSpec UI: opened ${title}.`);
}

async function pickChange(workspaceRoot: string): Promise<{ name: string; changeDir: string } | undefined> {
  const result = await listChanges({ cwd: workspaceRoot });
  if (result.changes.length === 0) {
    void vscode.window.showWarningMessage("OpenSpec UI: no changes found in openspec/changes/.");
    return undefined;
  }
  const pick = await vscode.window.showQuickPick(
    result.changes.map((change) => ({
      label: change.name,
      description: `${change.completedTasks}/${change.totalTasks} tasks — ${change.status}`,
    })),
    { placeHolder: "Select an OpenSpec change" },
  );
  if (!pick) return undefined;
  return { name: pick.label, changeDir: path.join(workspaceRoot, "openspec", "changes", pick.label) };
}

async function pickChangesForTimeline(
  workspaceRoot: string,
): Promise<Array<{ changeName: string; archived: boolean }> | undefined> {
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  const items = [
    ...workspace.changes.map((c) => ({ label: c.name, description: "active", archived: false })),
    ...workspace.archivedChanges.map((c) => ({ label: c.name, description: "archived", archived: true })),
  ];
  if (items.length === 0) {
    void vscode.window.showWarningMessage("OpenSpec UI: no changes found in openspec/changes/.");
    return undefined;
  }
  const picks = await vscode.window.showQuickPick(items, {
    placeHolder: "Select changes to compare",
    canPickMany: true,
  });
  if (!picks || picks.length === 0) return undefined;
  return picks.map((pick) => ({ changeName: pick.label, archived: pick.archived }));
}

/** The date-range axis for the multi-change view is derived from the
 * selected changes' own data (earliest/latest of every created/task/
 * archived date) rather than asking the user to type ISO dates — no
 * native date picker exists in VS Code's own prompt UI, and the data's
 * own extent is a reasonable default range. Falls back to a 1-day
 * window around now if no change carries any determinable date. */
function computeDefaultRange(timelines: ChangeTimeline[]): { rangeStart: string; rangeEnd: string } {
  const dates: string[] = [];
  for (const timeline of timelines) {
    if (timeline.createdDate) dates.push(timeline.createdDate);
    // Archiving is chronologically last, but archivedDate has no
    // time-of-day (parsed from the folder name) — end-of-day avoids it
    // sorting before that same day's actual created/task timestamps.
    if (timeline.archived && timeline.archivedDate) dates.push(`${timeline.archivedDate}T23:59:59.999Z`);
    for (const task of timeline.tasks) {
      if (task.date) dates.push(task.date);
    }
  }
  if (dates.length === 0) {
    const now = Date.now();
    return {
      rangeStart: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
      rangeEnd: new Date(now + 12 * 60 * 60 * 1000).toISOString(),
    };
  }
  const sorted = [...dates].sort();
  return { rangeStart: sorted[0] as string, rangeEnd: sorted[sorted.length - 1] as string };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** VS Code has no native date picker, so the sprint range is two
 * validated `showInputBox` prompts rather than the auto-derived range
 * `computeDefaultRange` uses elsewhere — this command needs a real
 * user-specified sprint boundary, not a default. Returns full-day ISO
 * bounds (start of `start`, end of `end`) so a task completed anywhere
 * during either boundary date is included. */
async function promptSprintRange(): Promise<{ rangeStart: string; rangeEnd: string } | undefined> {
  const validateInput = (value: string): string | undefined =>
    DATE_RE.test(value) && !Number.isNaN(Date.parse(value)) ? undefined : "Enter a date as YYYY-MM-DD.";
  const start = await vscode.window.showInputBox({
    title: "Sprint Report: Start Date",
    prompt: "First day of the sprint (YYYY-MM-DD)",
    placeHolder: "2026-08-01",
    validateInput,
  });
  if (!start) return undefined;
  const end = await vscode.window.showInputBox({
    title: "Sprint Report: End Date",
    prompt: "Last day of the sprint (YYYY-MM-DD)",
    placeHolder: "2026-08-14",
    validateInput,
  });
  if (!end) return undefined;
  return { rangeStart: `${start}T00:00:00.000Z`, rangeEnd: `${end}T23:59:59.999Z` };
}

export function registerCommands(context: vscode.ExtensionContext, deps: CommandsDeps): void {
  const timelinePanel = new TimelineWebviewPanel({ extensionUri: context.extensionUri });
  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.initialize", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) return;
      const selected = await vscode.window.showQuickPick(
        ["github-copilot", "claude", "codex", "gemini", "cursor", "cline", "continue", "opencode"],
        {
          title: "Initialize OpenSpec",
          placeHolder: "Select AI tool integrations",
          canPickMany: true,
        },
      );
      if (!selected || selected.length === 0) return;
      try {
        await runTrackedProcess(deps.implementationSessions, workspaceRoot, {
          operation: "initialize",
          mutating: true,
          execute: async () => { await initOpenSpec({ cwd: workspaceRoot }, { tools: selected }); },
        });
        deps.refreshTrees();
        void vscode.window.showInformationMessage("OpenSpec UI: workspace initialized.");
        void suggestAgenticHarnessSetup(workspaceRoot);
      } catch (error) {
        await showCommandError("initialize workspace", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.setUpAgenticHarness", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      try {
        await runSetUpAgenticHarness(workspaceRoot);
      } catch (error) {
        await showCommandError("set up Agentic Harness", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.generateAgentInstructions", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) return;
      const picked = await vscode.window.showQuickPick(
        listBootstrapProjectTypes().map((type) => ({ label: type.label, id: type.id })),
        { title: "Generate Agent Instructions", placeHolder: "Select a project type" },
      );
      if (!picked) return;
      try {
        const result = await writeAgentInstructions(workspaceRoot, picked.id);
        const written = [
          result.claude !== "skipped-foreign" ? "CLAUDE.md" : null,
          result.agents !== "skipped-foreign" ? "AGENTS.md" : null,
        ].filter((name): name is string => name !== null);
        for (const name of written) {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(workspaceRoot, name)));
          await vscode.window.showTextDocument(doc, { preview: false });
        }
        const skipped = [
          result.claude === "skipped-foreign" ? "CLAUDE.md" : null,
          result.agents === "skipped-foreign" ? "AGENTS.md" : null,
        ].filter((name): name is string => name !== null);
        if (skipped.length > 0) {
          void vscode.window.showWarningMessage(
            `OpenSpec UI: ${skipped.join(", ")} already exists and is not managed by openspec-ui — left untouched.`,
          );
        }
        if (written.length > 0) {
          void vscode.window.showInformationMessage(`OpenSpec UI: wrote ${written.join(", ")}.`);
        }
      } catch (error) {
        await showCommandError("generate agent instructions", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.configureHarness", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) return;
      const uri = vscode.Uri.file(path.join(workspaceRoot, "openspec", "agent-harness.json"));
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        // Doesn't exist yet — seed it with the documented default so the
        // file is immediately valid and schema-editable, not empty.
        await writeGlobalHarnessConfig(workspaceRoot, DEFAULT_HARNESS_CONFIG);
      }
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (error) {
        await showCommandError("open harness config", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.configureHarnessForChange", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      const uri = vscode.Uri.file(path.join(item.changeDir, "harness.json"));
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        // Doesn't exist yet — an empty override object (inherit
        // everything from the global config) is a valid, schema-editable
        // starting point, unlike the global file it has no required
        // fields.
        await writeChangeHarnessConfig(workspaceRoot, item.changeName, {});
      }
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (error) {
        await showCommandError("open per-change harness config", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.runWithHarness", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      if (item.archived) return;
      try {
        // Resolved fresh on every invocation (never cached) — see
        // agentic-harness-run-menu's design.md, "Menu entry always
        // resolves fresh, never caches the autonomy level": the user may
        // have just edited this change's harness.json via "Configure
        // Harness for this Change" immediately before running.
        const config = await resolveHarnessConfig(workspaceRoot, item.changeName);
        const target = resolveRunWithHarnessTarget(config);
        // `runChange` only for the picker target: a chain has one button
        // and nothing to pre-select, so seeding a command kind there
        // would describe a control that is not on screen.
        deps.revealAiPanel({
          ...dashboardContext(workspaceRoot, item.changeDir),
          startChain: target === "chain",
          runChange: target !== "chain",
        });
      } catch (error) {
        await showCommandError("resolve Agentic Harness config", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.configureDependabot", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) return;
      const picked = await vscode.window.showQuickPick(
        listBootstrapProjectTypes().map((type) => ({ label: type.label, id: type.id })),
        { title: "Configure Dependabot", placeHolder: "Select project type(s)", canPickMany: true },
      );
      if (!picked || picked.length === 0) return;
      try {
        const result = await writeDependabotConfig(workspaceRoot, picked.map((p) => p.id));
        if (result === "skipped-foreign") {
          void vscode.window.showWarningMessage(
            "OpenSpec UI: .github/dependabot.yml already exists and is not managed by openspec-ui — left untouched.",
          );
          return;
        }
        const doc = await vscode.workspace.openTextDocument(
          vscode.Uri.file(path.join(workspaceRoot, ".github", "dependabot.yml")),
        );
        await vscode.window.showTextDocument(doc, { preview: false });
        void vscode.window.showInformationMessage("OpenSpec UI: wrote .github/dependabot.yml.");
      } catch (error) {
        await showCommandError("configure dependabot", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.generateSubtypeInstructions", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) return;
      const projectType = await vscode.window.showQuickPick(
        listBootstrapProjectTypes().map((type) => ({ label: type.label, id: type.id })),
        { title: "Generate Path-Scoped Instructions", placeHolder: "Select a project type" },
      );
      if (!projectType) return;
      const subtype = await vscode.window.showQuickPick(
        (["backend", "frontend", "general"] as const).map((id) => ({ label: id, id })),
        { title: "Generate Path-Scoped Instructions", placeHolder: "Select a subtype" },
      );
      if (!subtype) return;
      try {
        const result = await writeSubtypeInstructions(workspaceRoot, projectType.id, subtype.id);
        const relativePath = path.join(".github", "instructions", `${subtype.id}.instructions.md`);
        if (result === "skipped-foreign") {
          void vscode.window.showWarningMessage(
            `OpenSpec UI: ${relativePath} already exists and is not managed by openspec-ui — left untouched.`,
          );
          return;
        }
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(workspaceRoot, relativePath)));
        await vscode.window.showTextDocument(doc, { preview: false });
        void vscode.window.showInformationMessage(`OpenSpec UI: wrote ${relativePath}.`);
      } catch (error) {
        await showCommandError("generate subtype instructions", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.createChange", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        warnNoWorkspace();
        return;
      }
      const changeName = await vscode.window.showInputBox({
        title: "Create OpenSpec Change",
        prompt: "Enter a lowercase change id",
        placeHolder: "improve-workbench",
        validateInput: (value) => /^[a-z0-9][a-z0-9._-]*$/.test(value)
          ? undefined
          : "Use lowercase letters, numbers, dots, dashes, or underscores.",
      });
      if (!changeName) return;
      try {
        await runTrackedProcess(deps.implementationSessions, workspaceRoot, {
          operation: "create",
          changeName,
          mutating: true,
          execute: async () => { await createChange(changeName, { cwd: workspaceRoot }); },
        });
        deps.refreshTrees();
        void vscode.window.showInformationMessage(`OpenSpec UI: created ${changeName}.`);
      } catch (error) {
        await showCommandError("create change", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.createChangeTemplate", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        warnNoWorkspace();
        return;
      }
      const changeName = await vscode.window.showInputBox({
        title: "Create Change Template",
        prompt: "Enter a lowercase change id",
        placeHolder: "improve-workbench",
        validateInput: (value) => /^[a-z0-9][a-z0-9._-]*$/.test(value)
          ? undefined
          : "Use lowercase letters, numbers, dots, dashes, or underscores.",
      });
      if (!changeName) return;

      try {
        await runTrackedProcess(deps.implementationSessions, workspaceRoot, {
          operation: "create",
          changeName,
          mutating: true,
          execute: async () => { await createChange(changeName, { cwd: workspaceRoot }); },
        });
        deps.refreshTrees();
      } catch (error) {
        await showCommandError("create change", error);
        return;
      }

      const useDefaults = "Use global Agentic Harness defaults";
      const customize = "Customize Agentic Harness for this change";
      const choice = await vscode.window.showQuickPick([useDefaults, customize], {
        title: `Agentic Harness for "${changeName}"`,
      });
      if (choice !== customize) {
        void vscode.window.showInformationMessage(`OpenSpec UI: created ${changeName}.`);
        return;
      }

      const config = await promptHarnessCustomization(changeName);
      if (config === undefined) {
        void vscode.window.showInformationMessage(
          `OpenSpec UI: created ${changeName}. Harness customization cancelled — this change inherits the global default.`,
        );
        return;
      }
      if (Object.keys(config).length === 0) {
        void vscode.window.showInformationMessage(`OpenSpec UI: created ${changeName}. No customization made — inherits the global default.`);
        return;
      }

      try {
        await writeChangeHarnessConfig(workspaceRoot, changeName, config);
        void vscode.window.showInformationMessage(`OpenSpec UI: created ${changeName} with a customized Agentic Harness override.`);
      } catch (error) {
        await showCommandError("write per-change harness config", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.validateSelectedChange", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      try {
        let result: Awaited<ReturnType<typeof validateChange>> | undefined;
        await runTrackedProcess(deps.implementationSessions, workspaceRoot, {
          operation: "validate",
          changeName: item.changeName,
          mutating: false,
          execute: async () => { result = await validateChange(item.changeName, { cwd: workspaceRoot }); },
        });
        if (!result) return;
        await openMarkdownDocument(
          `strict validation for ${item.changeName}`,
          formatValidateMarkdown(item.changeName, result),
        );
      } catch (error) {
        await showCommandError("validate change", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.showChangeTimeline", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      try {
        const timeline = await getChangeTimeline(workspaceRoot, item.changeName, item.archived);
        const staleThresholdDays = vscode.workspace
          .getConfiguration("openspec-ui")
          .get<number>("staleTaskThresholdDays", DEFAULT_STALE_TASK_THRESHOLD_DAYS);
        timelinePanel.show(item.changeName, timeline, staleThresholdDays);
      } catch (error) {
        await showCommandError("show change timeline", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.archiveChange", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      if (item.archived) return;
      const answer = await vscode.window.showWarningMessage(
        `Archive ${item.changeName}? Canonical specs may be updated.`,
        { modal: true },
        "Archive",
      );
      if (answer !== "Archive") return;
      try {
        await runTrackedProcess(deps.implementationSessions, workspaceRoot, {
          operation: "archive",
          changeName: item.changeName,
          mutating: true,
          execute: async () => { await archiveChange(item.changeName, { cwd: workspaceRoot }); },
        });
        deps.refreshTrees();
        void vscode.window.showInformationMessage(`OpenSpec UI: archived ${item.changeName}.`);
        void remindAboutPendingChangeset(workspaceRoot);
      } catch (error) {
        await showCommandError("archive change", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.unarchiveChange", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.archiveView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      if (!item.archived) return;
      const answer = await vscode.window.showWarningMessage(
        `Restore ${item.changeName} to active changes?`,
        { modal: true },
        "Unarchive",
      );
      if (answer !== "Unarchive") return;
      try {
        await runTrackedProcess(deps.implementationSessions, workspaceRoot, {
          operation: "unarchive",
          changeName: item.changeName,
          mutating: true,
          execute: async () => { await unarchiveChange(workspaceRoot, item.changeName); },
        });
        deps.refreshTrees();
        void vscode.window.showInformationMessage(`OpenSpec UI: unarchived ${item.changeName}.`);
      } catch (error) {
        await showCommandError("unarchive change", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.copyTasksAsTemplate", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.archiveView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      if (!item.archived) return;
      const target = await pickChange(workspaceRoot);
      if (!target) return;
      try {
        const template = await readArchivedChangeTasksTemplate(workspaceRoot, item.changeName);
        const tasksUri = vscode.Uri.file(path.join(target.changeDir, "tasks.md"));
        const document = await vscode.workspace.openTextDocument(tasksUri);
        const insertText = document.getText().trim().length > 0 ? `\n${template}` : template;
        const endOfDocument = document.lineAt(document.lineCount - 1).range.end;

        const edit = new vscode.WorkspaceEdit();
        edit.insert(tasksUri, endOfDocument, insertText);
        await vscode.workspace.applyEdit(edit);
        await vscode.window.showTextDocument(document, { preview: false });

        void vscode.window.showInformationMessage(
          `OpenSpec UI: inserted tasks template from ${item.changeName} into ${target.name}.`,
        );
      } catch (error) {
        await showCommandError("copy tasks as template", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.customizeTemplate", async (invokedItem?: TemplateTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.templatesView, isTemplateTreeItem);
      if (!item) { warnNoTreeSelection("template"); return; }
      if (item.template.origin !== "built-in") return;
      try {
        await customizeTemplate(workspaceRoot, item.template.manifest.id);
        deps.refreshTemplatesTree();
        // Open the created manifest as visible proof — a toast notification
        // alone is easy to miss/dismiss, and the tree refresh isn't visible
        // unless "Project" happens to already be expanded (found via live
        // testing: the command silently succeeds with no other feedback).
        const manifestUri = vscode.Uri.file(
          path.join(workspaceRoot, "openspec", "templates", item.template.manifest.id, "template.json"),
        );
        const manifestDocument = await vscode.workspace.openTextDocument(manifestUri);
        await vscode.window.showTextDocument(manifestDocument, { preview: false });
        void vscode.window.showInformationMessage(`OpenSpec UI: customized "${item.template.manifest.title}".`);
      } catch (error) {
        if (error instanceof TemplateAlreadyExistsError) {
          void vscode.window.showWarningMessage(
            `OpenSpec UI: ${item.template.manifest.id} is already customized in this project.`,
          );
          return;
        }
        await showCommandError("customize template", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.insertTemplateIntoChange", async (invokedItem?: TemplateTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.templatesView, isTemplateTreeItem);
      if (!item) { warnNoTreeSelection("template"); return; }
      const target = await pickChange(workspaceRoot);
      if (!target) return;

      const variables: Record<string, string | boolean> = {};
      for (const variable of item.template.manifest.variables) {
        if (variable.type === "boolean") {
          const pick = await vscode.window.showQuickPick(["Yes", "No"], { title: variable.prompt });
          if (pick === undefined) return;
          variables[variable.name] = pick === "Yes";
        } else {
          const value = await vscode.window.showInputBox({
            title: variable.prompt,
            value: variable.default !== undefined ? String(variable.default) : "",
          });
          if (value === undefined) return;
          variables[variable.name] = value;
        }
      }

      try {
        const rendered = renderTemplate(item.template, variables);
        const files: Array<["proposal.md" | "design.md" | "tasks.md", string]> = [
          ["proposal.md", rendered.proposal],
          ["design.md", rendered.design],
          ["tasks.md", rendered.tasks],
        ];
        for (const [fileName, content] of files) {
          const uri = vscode.Uri.file(path.join(target.changeDir, fileName));
          const document = await vscode.workspace.openTextDocument(uri);
          const insertText = document.getText().trim().length > 0 ? `\n${content}` : content;
          const endOfDocument = document.lineAt(document.lineCount - 1).range.end;
          const edit = new vscode.WorkspaceEdit();
          edit.insert(uri, endOfDocument, insertText);
          await vscode.workspace.applyEdit(edit);
        }

        const tasksDocument = await vscode.workspace.openTextDocument(
          vscode.Uri.file(path.join(target.changeDir, "tasks.md")),
        );
        await vscode.window.showTextDocument(tasksDocument, { preview: false });
        void vscode.window.showInformationMessage(
          `OpenSpec UI: inserted template "${item.template.manifest.title}" into ${target.name}.`,
        );
      } catch (error) {
        await showCommandError("insert template into change", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.deleteProjectTemplate", async (invokedItem?: TemplateTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.templatesView, isTemplateTreeItem);
      if (!item) { warnNoTreeSelection("template"); return; }
      if (item.template.origin !== "project") return;
      const answer = await vscode.window.showWarningMessage(
        `Permanently delete project template "${item.template.manifest.id}"?`,
        { modal: true },
        "Delete",
      );
      if (answer !== "Delete") return;
      try {
        await deleteProjectTemplate(workspaceRoot, item.template.manifest.id);
        deps.refreshTemplatesTree();
        void vscode.window.showInformationMessage(`OpenSpec UI: deleted "${item.template.manifest.title}".`);
      } catch (error) {
        if (error instanceof UnknownProjectTemplateError) {
          void vscode.window.showWarningMessage(`OpenSpec UI: ${error.message}`);
          return;
        }
        await showCommandError("delete project template", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.deleteChange", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      const answer = await vscode.window.showWarningMessage(
        `Permanently delete ${item.changeName} and all of its artifacts?`,
        { modal: true },
        "Delete",
      );
      if (answer !== "Delete") return;
      try {
        await runTrackedProcess(deps.implementationSessions, workspaceRoot, {
          operation: "delete",
          changeName: item.changeName,
          mutating: true,
          execute: async () => { await deleteChange(workspaceRoot, item.changeName, item.archived ? "archive" : "active"); },
        });
        deps.refreshTrees();
        void vscode.window.showInformationMessage(`OpenSpec UI: deleted ${item.changeName}.`);
      } catch (error) {
        await showCommandError("delete change", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.revealTask", async (invokedItem?: TaskTreeItem) => {
      const item = resolveTreeItem(invokedItem, deps.changesView, isTaskTreeItem);
      if (!item) { warnNoTreeSelection("task"); return; }
      try {
        const tasksUri = vscode.Uri.file(path.join(item.changeDir, "tasks.md"));
        const document = await vscode.workspace.openTextDocument(tasksUri);
        const editor = await vscode.window.showTextDocument(document, { preview: false });
        const range = document.lineAt(resolveTaskLine(document, item.lineNumber, item.text)).range;
        editor.selection = new vscode.Selection(range.start, range.start);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      } catch (error) {
        await showCommandError("reveal task", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.deleteTask", async (invokedItem?: TaskTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isTaskTreeItem);
      if (!item) { warnNoTreeSelection("task"); return; }
      if (item.archived || item.done) return;
      const answer = await vscode.window.showWarningMessage(
        `Permanently delete task "${item.text}" from ${item.changeName}'s tasks.md?`,
        { modal: true },
        "Delete",
      );
      if (answer !== "Delete") return;
      try {
        await deleteTaskLine(workspaceRoot, item.changeName, item.archived, item.lineNumber, item.text);
        deps.refreshTrees();
        void vscode.window.showInformationMessage(`OpenSpec UI: deleted task from ${item.changeName}.`);
      } catch (error) {
        if (error instanceof TaskListChangedError) {
          void vscode.window.showWarningMessage(`OpenSpec UI: ${error.message}`);
          return;
        }
        await showCommandError("delete task", error);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.startImplementation", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      if (item.archived) return;
      try {
        const processId = await deps.implementationSessions.start(workspaceRoot, item.changeName);
        const prompt = buildWorkbenchChatPrompt({
          stage: "apply",
          changeName: item.changeName,
          workspaceRoot,
          changeDir: item.changeDir,
          processId,
        });
        await vscode.commands.executeCommand("workbench.action.chat.open", { query: prompt, mode: "agent" });
        void vscode.window.showInformationMessage(`OpenSpec UI: implementation session started for ${item.changeName}.`);
      } catch (error) {
        await showCommandError("start implementation", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.finishImplementation", async (item?: { process?: { id?: string } }) => {
      const processId = item?.process?.id;
      if (processId && deps.implementationSessions.finish(processId)) {
        const workspaceRoot = deps.getWorkspaceRoot();
        if (workspaceRoot) deps.revealAiPanel(dashboardContext(workspaceRoot));
        void vscode.window.showInformationMessage("OpenSpec UI: finalizing checkpoint for review.");
      }
    }),
    vscode.commands.registerCommand("openspec-ui.rollbackProcess", async (item?: { process?: { id?: string } }) => {
      const processId = item?.process?.id;
      if (!processId) return;
      const delta = await deps.implementationSessions.getDelta(processId);
      if (!delta) {
        void vscode.window.showWarningMessage("OpenSpec UI: this process has no finalized checkpoint.");
        return;
      }
      const coverage = await deps.implementationSessions.getCoverage(processId);
      const answer = await vscode.window.showWarningMessage(
        `Rollback ${delta.length} file change${delta.length === 1 ? "" : "s"}?`,
        {
          modal: true,
          detail: [
            ...delta.map((entry) => `${entry.kind}: ${entry.path}`),
            ...(coverage?.skippedFiles ?? [])
              .map((filePath) => `not covered: ${filePath}`),
            ...((coverage?.excludedDirectories.length ?? 0) > 0
              ? [`excluded directory classes: ${coverage?.excludedDirectories.join(", ")}`]
              : []),
          ].join("\n"),
        },
        "Rollback",
      );
      if (answer !== "Rollback") return;
      try {
        const result = await deps.implementationSessions.rollback(processId);
        if (result.conflicts.length > 0) {
          void vscode.window.showErrorMessage(`OpenSpec UI: rollback blocked by later changes: ${result.conflicts.join(", ")}`);
          return;
        }
        deps.refreshTrees();
        void vscode.window.showInformationMessage(`OpenSpec UI: restored ${result.restored.length} files.`);
      } catch (error) {
        await showCommandError("rollback", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.rollbackChange", async (invokedItem?: ChangeTreeItem) => {
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      const details = await deps.implementationSessions.changeRollbackDetails(item.changeName);
      if (!details) {
        void vscode.window.showWarningMessage(`OpenSpec UI: no rollback-eligible processes for ${item.changeName}.`);
        return;
      }
      const answer = await vscode.window.showWarningMessage(
        `Rollback ${item.changeName}? This restores ${details.fileCount} file${details.fileCount === 1 ? "" : "s"} across ${details.processCount} process${details.processCount === 1 ? "" : "es"} to their state before this change was ever implemented.`,
        { modal: true },
        "Rollback",
      );
      if (answer !== "Rollback") return;
      try {
        const result = await deps.implementationSessions.rollbackChange(item.changeName);
        if (result.conflicts.length > 0) {
          void vscode.window.showErrorMessage(`OpenSpec UI: rollback blocked by later changes: ${result.conflicts.join(", ")}`);
          return;
        }
        deps.refreshTrees();
        void vscode.window.showInformationMessage(`OpenSpec UI: restored ${result.restored.length} files.`);
      } catch (error) {
        await showCommandError("rollback change", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.cancelProcess", (item?: { process?: { id?: string } }) => {
      if (item?.process?.id) deps.implementationSessions.cancel(item.process.id);
    }),
    vscode.commands.registerCommand("openspec-ui.status", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        void vscode.window.showErrorMessage("OpenSpec UI: open a folder or workspace first.");
        return;
      }

      const selected = await pickChange(workspaceRoot);
      if (!selected) return;

      const command: Command = {
        kind: "status",
        cwd: workspaceRoot,
        runId: crypto.randomUUID(),
        context: { changeDir: selected.changeDir },
      };

      deps.outputChannel.clear();
      deps.outputChannel.show(true);
      deps.revealAiPanel(dashboardContext(workspaceRoot, selected.changeDir));

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `OpenSpec UI: status — ${selected.name}`,
          cancellable: false,
        },
        async () => {
          const unsubscribe = deps.runController.onEvent((event) => {
            deps.outputChannel.appendLine(describeEvent(event));
          });
          try {
            await deps.runController.run(undefined, command);
          } finally {
            unsubscribe();
          }
        },
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.openspecView", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        void vscode.window.showErrorMessage("OpenSpec UI: open a folder or workspace first.");
        return;
      }
      const terminal = vscode.window.createTerminal({ name: "OpenSpec UI: openspec view", cwd: workspaceRoot });
      terminal.show(true);
      terminal.sendText("openspec view", true);

      try {
        const [changes, specs] = await Promise.all([
          listChanges({ cwd: workspaceRoot }),
          listSpecs({ cwd: workspaceRoot }),
        ]);
        const markdown = formatOpenSpecViewSummaryMarkdown(workspaceRoot, changes, specs);
        await openMarkdownDocument("openspec view summary", markdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showWarningMessage(`OpenSpec UI: failed to build parsed openspec view summary (${message}).`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.showAllChangesTimeline", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        void vscode.window.showErrorMessage("OpenSpec UI: open a folder or workspace first.");
        return;
      }
      const entries = await pickChangesForTimeline(workspaceRoot);
      if (!entries) return;
      try {
        const timelines = await getChangeTimelines(workspaceRoot, entries);
        const { rangeStart, rangeEnd } = computeDefaultRange(timelines);
        timelinePanel.showMulti({ timelines, rangeStart, rangeEnd });
      } catch (error) {
        await showCommandError("show change comparison", error);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.generateSprintReport", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        void vscode.window.showErrorMessage("OpenSpec UI: open a folder or workspace first.");
        return;
      }
      const entries = await pickChangesForTimeline(workspaceRoot);
      if (!entries) return;
      const range = await promptSprintRange();
      if (!range) return;
      try {
        const report = await buildSprintReport(workspaceRoot, entries, range.rangeStart, range.rangeEnd);
        const pdf = await renderSprintReportPdf(report);
        const defaultName = `sprint-report-${range.rangeStart.slice(0, 10)}-${range.rangeEnd.slice(0, 10)}.pdf`;
        const target = await vscode.window.showSaveDialog({
          filters: { PDF: ["pdf"] },
          defaultUri: vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), defaultName),
        });
        if (!target) return;
        await vscode.workspace.fs.writeFile(target, pdf);
        const action = await vscode.window.showInformationMessage(
          `OpenSpec UI: sprint report saved to ${target.fsPath}.`,
          "Open",
        );
        if (action === "Open") await vscode.env.openExternal(target);
      } catch (error) {
        await showCommandError("generate sprint report", error);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.showChangeDetails", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        void vscode.window.showErrorMessage("OpenSpec UI: open a folder or workspace first.");
        return;
      }
      const selected = await pickChange(workspaceRoot);
      if (!selected) return;
      const result = await showChange(selected.name, { cwd: workspaceRoot });
      await openMarkdownDocument(`change details for ${selected.name}`, formatShowMarkdown(result));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.validateChangeStrict", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        void vscode.window.showErrorMessage("OpenSpec UI: open a folder or workspace first.");
        return;
      }
      const selected = await pickChange(workspaceRoot);
      if (!selected) return;
      const result = await validateChange(selected.name, { cwd: workspaceRoot });
      await openMarkdownDocument(`strict validation for ${selected.name}`, formatValidateMarkdown(selected.name, result));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.listSpecsSummary", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        void vscode.window.showErrorMessage("OpenSpec UI: open a folder or workspace first.");
        return;
      }
      const result = await listSpecs({ cwd: workspaceRoot });
      const lines = ["# OpenSpec specs", "", ...result.specs.map((spec) => `- ${spec.id}: ${spec.requirementCount} requirements`)];
      await openMarkdownDocument("spec summary", lines.join("\n"));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.openAiPanel", (item?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        warnNoWorkspace();
        return;
      }
      deps.revealAiPanel(dashboardContext(workspaceRoot, item?.changeDir));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.reviewDiff", async (invokedItem?: ChangeTreeItem) => {
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      const tasksPath = path.join(item.changeDir, "tasks.md");
      await openDiffAgainstHead(
        vscode.Uri.file(tasksPath),
        `${item.changeName}: tasks.md (HEAD ↔ working tree)`,
      );
    }),
  );
}
