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
  buildChangeCostReport,
  buildSprintReport,
  findHarnessConfigLimits,
  readTaskChecklist,
  readChangeHarnessConfig,
  buildRunPlan,
  templateConfigToWrite,
  templatesForScope,
  type HarnessTemplate,
  type RunPlan,
  type RunPathId,
  type RecommendationInput,
  recommendTemplate,
  checkChangesetReminder,
  createChange,
  customizeTemplate,
  deleteChange,
  deleteProjectTemplate,
  deleteTaskLine,
  detectAvailableAgentsDetailed,
  discoverOpenSpecWorkspace,
  getChangeTimeline,
  readChangeGraph,
  getChangeTimelines,
  initOpenSpec,
  listBootstrapProjectTypes,
  listChanges,
  isHarnessStepAgentStage,
  listSpecs,
  resolveCheckScripts,
  runMechanicalCheck,
  normalizeStepAgent,
  stepAgentFor,
  readArchivedChangeTasksTemplate,
  readGlobalHarnessConfig,
  renderSprintReportPdf,
  renderTemplate,
  resolveHarnessConfig,
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
  type CheckScriptName,
  type AuditEntry,
  type ChangeCostReport,
} from "@openspec-ui/core";
import type { RunController } from "./run-controller.js";
import { ancestryOf, findGraphRows, type ChangeGraphTreeItem, type GraphTreeNode } from "./tree/change-graph-tree.js";
import { describeEvent } from "./describe-event.js";
import { readConfig } from "./config.js";
import { openDiffAgainstHead } from "./native/diff.js";
import { ChangeTreeItem } from "./tree/changes-tree.js";
import type { TaskTreeItem } from "./tree/changes-tree.js";
import type { TemplateTreeItem } from "./tree/templates-tree.js";
import type { ImplementationSessionManager } from "./implementation-sessions.js";
import type { AiPanelContext } from "./webview/ai-panel.js";
import { buildWorkbenchChatPrompt } from "./workbench-chat-prompt.js";
import { TimelineWebviewPanel } from "./webview/timeline-panel.js";

/** The part of a `vscode.TreeView` the item-scoped commands read: the
 * rows currently highlighted in it. Narrower than `TreeView` on purpose —
 * nothing here expands or disposes a view. */
export interface TreeSelectionView {
  readonly selection: readonly unknown[];
}

/** `TreeSelectionView` plus `reveal` — what `openspec-ui.revealInChangeGraph`
 * and `openspec-ui.revealInChanges` need on top of reading the selection:
 * a place to reveal the other view's row into. Only the views a reveal
 * command targets need this; `templatesView` still only needs selection. */
export interface RevealableTreeView<T> extends TreeSelectionView {
  reveal(
    element: T,
    options?: { select?: boolean; focus?: boolean; expand?: boolean | number },
  ): Thenable<void>;
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
  /** Undefined until a workspace is open — the four views only exist
   * once there is a workspace root to build them from. */
  changesView?: RevealableTreeView<ChangeTreeItem>;
  archiveView?: RevealableTreeView<ChangeTreeItem>;
  templatesView?: TreeSelectionView;
  changeGraphView?: RevealableTreeView<GraphTreeNode>;
  /** Reads the workspace's audit log. Undefined without an open
   * workspace, where there is nowhere for one to live — the same reason
   * `chain-runner-audit-deps.ts` treats an absent root as a real case
   * rather than a reader over nothing. */
  readAuditEntries?: () => Promise<AuditEntry[]>;
}

/** Renders a change's cost report as Markdown. Core produced the
 * structure; this decides how it reads — including the two places the
 * numbers must not be tidied: a figure the agent never reported shows as
 * "not reported", never as `$0.00`, and the totals line says it covers
 * only what was reported. */
export function renderChangeCostReport(changeName: string, report: ChangeCostReport): string {
  const lines: string[] = [`# What ${changeName} cost`, ""];
  if (!report.hasRecords) {
    lines.push("Nothing has run against this change.", "");
    lines.push("This is not the same as a change that ran and reported nothing —");
    lines.push("there are no records for it at all.");
    return lines.join("\n");
  }

  const money = (value: number | undefined): string => (value === undefined ? "not reported" : `$${value.toFixed(2)}`);
  const count = (value: number | undefined): string => (value === undefined ? "not reported" : value.toLocaleString());
  const duration = (value: number | undefined): string => {
    if (value === undefined) return "still running";
    const seconds = Math.round(value / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m${String(seconds % 60).padStart(2, "0")}s`;
  };

  lines.push("| Stage | Agent | Effort | Outcome | Cost | Tokens in | Tokens out | Duration |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const row of report.rows) {
    lines.push([
      "",
      row.stage ?? "_unattributed_",
      row.agent,
      row.effort ?? "—",
      row.outcome,
      money(row.costUsd),
      count(row.inputTokens),
      count(row.outputTokens),
      duration(row.durationMs),
      "",
    ].join(" | ").trim());
  }
  lines.push("");
  lines.push(`**Reported total:** ${money(report.reportedCostUsd)}`
    + `, ${count(report.reportedInputTokens)} in, ${count(report.reportedOutputTokens)} out`
    + `, ${duration(report.totalDurationMs)}.`);
  if (report.rowsWithNothingReported > 0) {
    lines.push("");
    lines.push(`${report.rowsWithNothingReported} of ${report.rows.length} run(s) reported nothing at all,`);
    lines.push("so the totals above cover only part of what happened. Most supported");
    lines.push("agents report no usage; see LIMITS.md for which.");
  }
  if (report.rows.some((row) => row.stage === undefined)) {
    lines.push("");
    lines.push("_Unattributed_ rows are records written before runs carried the stage");
    lines.push("they belonged to. They are counted in the totals and not guessed at.");
  }
  const withReasons = report.rows.filter((row) => row.reason !== undefined);
  if (withReasons.length > 0) {
    lines.push("", "## How runs ended", "");
    for (const row of withReasons) {
      lines.push(`- ${row.stage ?? "unattributed"} (${row.outcome}): ${row.reason ?? ""}`);
    }
  }
  return lines.join("\n");
}

const CHECK_TITLES: Record<CheckScriptName, string> = {
  typecheck: "typecheck",
  test: "test",
  lint: "lint",
};

/** Runs one of the workspace's own `typecheck`/`test`/`lint` checks
 * through the exact same `runMechanicalCheck` the harness's `verify` stage
 * uses (design.md, "report where a stage's checks report"), reporting
 * through `deps.outputChannel` the same way `openspec-ui.status` does.
 * Defensively re-resolves and no-ops with a warning if the check is not
 * declared — the palette/menu `when` clauses hide the command in that
 * case, but a keybinding or `executeCommand` call could still reach it. */
async function runCheckCommand(deps: CommandsDeps, name: CheckScriptName): Promise<void> {
  const workspaceRoot = deps.getWorkspaceRoot();
  if (!workspaceRoot) { warnNoWorkspace(); return; }

  const resolved = await resolveCheckScripts(workspaceRoot, readConfig().checks);
  const script = resolved[name];
  if (!script) {
    void vscode.window.showWarningMessage(
      `OpenSpec UI: no "${name}" check is declared by this workspace ` +
      `(no "openspec-ui.checks.${name}" setting, "osui-${name}" script, or "${name}" script).`,
    );
    return;
  }

  deps.outputChannel.clear();
  deps.outputChannel.show(true);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `OpenSpec UI: ${CHECK_TITLES[name]}`,
      cancellable: false,
    },
    async () => {
      const result = await runMechanicalCheck(name, undefined, {
        workspaceRoot,
        changeDir: workspaceRoot,
        changeName: "",
        scripts: { [name]: script },
      });
      deps.outputChannel.appendLine(result.reason);
      if (result.pass) {
        void vscode.window.showInformationMessage(`OpenSpec UI: ${CHECK_TITLES[name]} passed (${script}).`);
      } else {
        void vscode.window.showErrorMessage(
          `OpenSpec UI: ${CHECK_TITLES[name]} failed — see the OpenSpec UI output channel for the command and its output.`,
        );
      }
    },
  );
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
const GRAPH_ROW_CONTEXT_VALUES = new Set(["openspec-ui.graphActiveChange", "openspec-ui.graphArchivedChange"]);

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

function isChangeGraphTreeItem(candidate: unknown): candidate is ChangeGraphTreeItem {
  return GRAPH_ROW_CONTEXT_VALUES.has(contextValueOf(candidate) ?? "");
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

/** What the run dialog can reason a recommendation from: this change's
 * remaining work and how its previous runs ended. Returns nothing when
 * neither can be read — "no recommendation" and "a recommendation with no
 * grounds" are different, and only the first is honest. */
async function readRecommendationInput(
  deps: CommandsDeps,
  workspaceRoot: string,
  item: ChangeTreeItem,
): Promise<{ recommendationInput?: RecommendationInput }> {
  try {
    const tasks = await readTaskChecklist(workspaceRoot, item.changeName, item.archived);
    const entries = deps.readAuditEntries ? await deps.readAuditEntries() : [];
    return {
      recommendationInput: {
        openTaskCount: tasks.filter((task) => !task.done).length,
        history: buildChangeCostReport(entries, item.changeDir),
      },
    };
  } catch {
    // An unreadable task list is not a reason to refuse the run — it is a
    // reason to run without advice, and to say nothing rather than guess.
    return {};
  }
}

/** A quick-pick gives one line per field and cuts the rest without
 * saying so. Measured from a screenshot on 2026-09-08: the placeholder
 * ended "every c…" and a recommendation's grounds ended "reads as short
 * …".
 *
 * So text that will not fit is shortened here, where the ellipsis is
 * deliberate, rather than by the control, where it lands mid-word and
 * reads as a rendering accident. The width is a judgement — a quick-pick
 * has no width to ask — sized from the same screenshot.
 *
 * The real fix is a surface that can hold a paragraph; this keeps the
 * one that cannot from lying about it. */
const QUICK_PICK_LINE = 96;

function fitOneLine(text: string): string {
  return text.length <= QUICK_PICK_LINE ? text : `${text.slice(0, QUICK_PICK_LINE - 1).trimEnd()}…`;
}

/** `vscode.QuickPickItemKind.Separator`. Taken as a literal rather than
 * from the enum so the test double, which stubs the window API and not
 * the enums, does not have to grow a copy of it. */
const QUICK_PICK_SEPARATOR = -1;

/** What the dialog can be answered with. Starting a run and configuring
 * the change are different acts: a path is chosen for one run and writes
 * nothing, a named configuration is written and holds until someone
 * changes it. */
type RunChoice =
  | { kind: "path"; path: RunPathId }
  | { kind: "apply-template"; template: HarnessTemplate };

/** Shows what the configuration resolves to and lets it be changed for
 * this run only. Nothing here writes `harness.json`: a run is not a
 * configuration change, and a later run behaving differently for a reason
 * nobody recorded is worse than being asked again. */
async function pickRunPath(changeName: string, plan: RunPlan): Promise<RunChoice | undefined> {
  const advice = plan.advice;

  const items: Array<{ label: string; detail?: string; description?: string; choice?: RunChoice; kind?: number }> = [];

  // The advice leads, as its own item. It used to ride in `placeHolder`,
  // a grey line that truncates — present in the object and absent from
  // the reader, which is the same defect this dialog exists to fix.
  // See run-dialog-actually-advises.
  if (advice) {
    items.push({ label: "Recommended", kind: QUICK_PICK_SEPARATOR });
    items.push({
      label: advice.needsPerson
        ? "$(person) A person should look, rather than a larger ceiling"
        : `$(lightbulb) Apply "${advice.template?.title ?? "none"}"`,
      // The grounds travel with the answer. A recommendation whose
      // reasons are hidden can only be accepted or ignored — and one cut
      // mid-sentence is hidden in a way that looks like it is not.
      detail: fitOneLine(advice.grounds.join("  ·  ")),
      ...(advice.needsPerson || !advice.template
        ? {}
        : { choice: { kind: "apply-template", template: advice.template } as RunChoice }),
    });
  }

  items.push({ label: "Start", kind: QUICK_PICK_SEPARATOR });
  const paths = plan.offered.map((path) => ({
    label: path.id === plan.resolved ? `${path.title}  (configured)` : path.title,
    detail: path.id === plan.resolved ? `${path.describes}  ${plan.because}.` : path.describes,
    choice: { kind: "path", path: path.id } as RunChoice,
  }));
  // The configured path first, so the pick opens on it. `showQuickPick`
  // has no preselection for a single pick — same stand-in the setup
  // wizard uses.
  paths.sort((a, b) => (a.choice.kind === "path" && a.choice.path === plan.resolved ? -1
    : b.choice.kind === "path" && b.choice.path === plan.resolved ? 1 : 0));
  items.push(...paths);

  // Every named configuration a change may be given, so a recommendation
  // is something a person can act on rather than a remark. Scoped by the
  // same function the settings view uses, so a template that would be
  // refused on save is never offered.
  items.push({ label: "Or apply a named configuration", kind: QUICK_PICK_SEPARATOR });
  for (const template of templatesForScope("change")) {
    items.push({
      // No `description`: that field renders right of the label and is
      // the first thing a quick-pick truncates, so putting a sentence
      // there produces text that is present and unreadable — the defect
      // this dialog exists to fix, in a new place. Measured from a
      // screenshot on 2026-09-08: every template's intent was cut
      // mid-word.
      //
      // `notFor` alone, because it is the sentence that helps someone
      // pick: a list of options carrying only advantages gives no help
      // choosing between them. The full text is in the settings view and
      // in the standalone dialog, both of which have room for it.
      label: template.id === advice?.template?.id ? `${template.title}  (recommended)` : template.title,
      detail: `Not for: ${template.notFor}`,
      choice: { kind: "apply-template", template } as RunChoice,
    });
  }

  const stages = plan.stageAgents
    .map((entry) => `${entry.stage}: ${entry.agent ?? "no agent set"}`)
    .join(", ");
  // Said either way. Rendering nothing when every ceiling can act makes
  // "examined and fine" identical to "not examined".
  const ceilings = plan.findings.length === 0
    ? "every ceiling can act"
    : `${plan.findings.length} setting(s) cannot act — ${plan.findings.map((f) => f.stage).join(", ")}`;

  const picked = await vscode.window.showQuickPick(items, {
    title: `Run ${changeName}`,
    placeHolder: fitOneLine(`${stages}  |  ${ceilings}`),
    ignoreFocusOut: true,
  });
  return picked?.choice;
}

/** The path that used to be `openspec-ui.startImplementation`. It is not
 * a separate way of working — `vscode-chat` is already a step agent, so
 * this is the `apply` stage run by it, and it looked separate only
 * because it had its own command. */
async function startVsCodeAgentImplementation(
  deps: CommandsDeps,
  workspaceRoot: string,
  item: ChangeTreeItem,
): Promise<void> {
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
    // Registered, but contributed by no menu and no palette entry — see
    // one-way-in-to-run tasks.md 3.2, which first said this command would
    // be deleted outright. The chat participant's `/implement` calls it
    // directly, and a person who has already typed `/implement` must not
    // be handed a dialog asking what they meant. Keeping the id also
    // keeps any existing keybinding working. It is not a second way in:
    // a command absent from `contributes.commands` appears in no menu and
    // no palette.
    vscode.commands.registerCommand("openspec-ui.startImplementation", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      if (item.archived) return;
      try {
        await startVsCodeAgentImplementation(deps, workspaceRoot, item);
      } catch (error) {
        await showCommandError("start implementation", error);
      }
    }),
    // The one way in. It used to be two — this command, which read the
    // configuration and revealed a panel without saying what it had read,
    // and `startImplementation`, which never read the configuration at
    // all. Which one a person wanted was a value in a file that one of
    // them ignored, and picking wrong was not visibly wrong: on an
    // `assisted` change this looked like it only changed tabs. Keeping
    // the command id so existing keybindings and menus survive; see
    // one-way-in-to-run.
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
        const plan = buildRunPlan(config, {
          hasVsCodeAgent: true,
          ...(await readRecommendationInput(deps, workspaceRoot, item)),
        });
        const chosen = await pickRunPath(item.changeName, plan);
        if (!chosen) return;

        // Applying a named configuration writes the change's file and
        // starts nothing. The run that follows should be the one the file
        // describes, which means reading it again — so this ends here and
        // the person opens Run once more, now configured.
        if (chosen.kind === "apply-template") {
          // Laid over what the change already has, not written in its
          // place. The writer replaces the file, so a key the template
          // does not mention — `gitStageAllowlist` above all — would be
          // deleted by applying one. Someone reaching for a cheaper run
          // has not asked for the constraint on what the agent may stage
          // to be removed. See applying-a-template-keeps-the-rest.
          //
          // Through the same `core` function the standalone shell writes
          // through: the configuration carries an effort level rather
          // than a value, and resolving it against the agent each stage
          // uses is not something two hosts should each get right
          // separately. See presets-by-effort.
          const existing = await readChangeHarnessConfig(workspaceRoot, item.changeName);
          await writeChangeHarnessConfig(
            workspaceRoot,
            item.changeName,
            templateConfigToWrite(chosen.template, config.stepAgents ?? {}, existing ?? {}),
          );
          void vscode.window.showInformationMessage(
            `OpenSpec UI: applied "${chosen.template.title}" to ${item.changeName}. Run it again to start.`,
          );
          return;
        }

        if (chosen.path === "vscode-agent") {
          await startVsCodeAgentImplementation(deps, workspaceRoot, item);
          return;
        }
        // `runChange` only for the picker target: a chain has one button
        // and nothing to pre-select, so seeding a command kind there
        // would describe a control that is not on screen.
        deps.revealAiPanel({
          ...dashboardContext(workspaceRoot, item.changeDir),
          startChain: chosen.path === "chain",
          runChange: chosen.path !== "chain",
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
    // The question the graph exists to answer — why is this here — asked
    // from the change rather than from the graph. A quick pick rather than
    // a rendered document because the answer is a list you then navigate:
    // picking an ancestor opens it.
    // Offered with no condition on the change's state: a change that
    // failed halfway is where the question is most pressing — money went
    // in and nothing shipped — and a command that appeared only on
    // finished changes would be missing exactly then.
    // Also a command, not only the settings panel: HARNESS.md says
    // outright that some settings have no control in either host and must
    // be hand-edited, and a person doing that has no settings screen open.
    // Beside the cost report, which reads the same two things: a task
    // list and the audit log. The settings view cannot — it runs in the
    // browser — and plumbing it there would cost a REST route and a
    // bridge for the same sentence on screen.
    vscode.commands.registerCommand("openspec-ui.recommendHarnessTemplate", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem)
        ?? resolveTreeItem(invokedItem, deps.archiveView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      try {
        const tasks = await readTaskChecklist(workspaceRoot, item.changeName, item.archived);
        const entries = deps.readAuditEntries ? await deps.readAuditEntries() : [];
        const recommendation = recommendTemplate({
          openTaskCount: tasks.filter((task) => !task.done).length,
          history: buildChangeCostReport(entries, item.changeDir),
        });
        // The grounds are shown with the answer, never behind it: a
        // recommendation whose reasons are hidden can only be accepted or
        // ignored, and the cases a reader would argue with are the ones
        // where it is worst.
        const grounds = recommendation.grounds.map((line) => `- ${line}`).join("\n");
        const headline = recommendation.needsPerson
          ? `${item.changeName}: this needs a person, not a bigger ceiling.`
          : `${item.changeName}: try "${recommendation.template?.title ?? "no template"}".`;
        await vscode.window.showInformationMessage(headline, { modal: true, detail: grounds });
      } catch (error) {
        await showCommandError("recommend a harness configuration", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.explainHarnessSettings", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem)
        ?? resolveTreeItem(invokedItem, deps.archiveView, isChangeTreeItem);
      try {
        const config = await resolveHarnessConfig(workspaceRoot, item?.changeName);
        const findings = findHarnessConfigLimits(config);
        if (findings.length === 0) {
          await vscode.window.showInformationMessage(
            item
              ? `Every ceiling configured for ${item.changeName} can act on the agent chosen for its stage.`
              : "Every ceiling in the global harness configuration can act on the agent chosen for its stage.",
          );
          return;
        }
        // Shown as a list rather than one message: each finding names a
        // different stage, and a single string would bury all but the
        // first.
        await vscode.window.showQuickPick(
          findings.map((finding) => ({ label: finding.stage, detail: finding.message, description: finding.agent })),
          {
            title: item ? `What ${item.changeName}'s harness settings cannot do` : "What the harness settings cannot do",
            placeHolder: "These settings are valid and will be used; these ceilings cannot act",
          },
        );
      } catch (error) {
        await showCommandError("explain the harness settings", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.showChangeCostReport", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem)
        ?? resolveTreeItem(invokedItem, deps.archiveView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      if (!deps.readAuditEntries) {
        await vscode.window.showInformationMessage("No audit log is available for this workspace.");
        return;
      }
      try {
        const entries = await deps.readAuditEntries();
        const report = buildChangeCostReport(entries, item.changeDir);
        const document = await vscode.workspace.openTextDocument({
          language: "markdown",
          content: renderChangeCostReport(item.changeName, report),
        });
        await vscode.window.showTextDocument(document, { preview: true });
      } catch (error) {
        await showCommandError("show what a change cost", error);
      }
    }),
    vscode.commands.registerCommand("openspec-ui.showChangeAncestry", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem)
        ?? resolveTreeItem(invokedItem, deps.archiveView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      try {
        const nodes = await readChangeGraph(workspaceRoot);
        if (!nodes.has(item.changeName)) {
          await vscode.window.showInformationMessage(`No change with id "${item.changeName}".`);
          return;
        }
        const ancestors = ancestryOf(nodes, item.changeName);
        if (ancestors.length === 0) {
          await vscode.window.showInformationMessage(
            `${item.changeName} follows nothing. An absent relation is not a defect.`,
          );
          return;
        }
        const picked = await vscode.window.showQuickPick(
          ancestors.map((node) => ({
            label: node.id,
            description: node.archived ? "archived" : "active",
            detail: node.supersedes.length > 0 ? `supersedes ${node.supersedes.join(", ")}` : undefined,
            node,
          })),
          { title: `What ${item.changeName} follows`, placeHolder: "Open one to read why it exists" },
        );
        if (!picked) return;
        const directory = picked.node.metadataPath.replace(/\/\.openspec\.yaml$/u, "");
        await vscode.commands.executeCommand(
          "vscode.open",
          vscode.Uri.file(path.join(workspaceRoot, directory, "proposal.md")),
        );
      } catch (error) {
        await showCommandError("show what a change follows", error);
      }
    }),
    // Where a change occupies several rows (more than one parent), every
    // row is revealed and the count is reported — choosing one silently
    // would hide exactly the relationship that made the change occupy
    // several (design.md, "every row, and say how many"). Most changes
    // state no relation at all (proposal.md's measurement), so that case
    // is reported too, not treated as an error.
    vscode.commands.registerCommand("openspec-ui.revealInChangeGraph", async (invokedItem?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changesView, isChangeTreeItem)
        ?? resolveTreeItem(invokedItem, deps.archiveView, isChangeTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      if (!deps.changeGraphView) { warnNoWorkspace(); return; }
      try {
        const rows = await findGraphRows(workspaceRoot, item.changeName);
        if (rows.length === 0) {
          void vscode.window.showInformationMessage(
            `OpenSpec UI: ${item.changeName} states no relation — it does not appear in the Change Graph.`,
          );
          return;
        }
        for (const [index, row] of rows.entries()) {
          await deps.changeGraphView.reveal(row, { select: index === 0, focus: index === 0, expand: true });
        }
        if (rows.length > 1) {
          void vscode.window.showInformationMessage(
            `OpenSpec UI: ${item.changeName} is shown in ${rows.length} places in the Change Graph.`,
          );
        }
      } catch (error) {
        await showCommandError("reveal in Change Graph", error);
      }
    }),
    // Unambiguous in this direction — a graph row is exactly one change.
    // Routes by the row's own `archived` flag (design.md, "route by the
    // row's own archived flag"), and reports rather than throwing when the
    // change is no longer where that flag says, since the graph is read
    // from disk on refresh and can outlive the change it names.
    vscode.commands.registerCommand("openspec-ui.revealInChanges", async (invokedItem?: ChangeGraphTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) { warnNoWorkspace(); return; }
      const item = resolveTreeItem(invokedItem, deps.changeGraphView, isChangeGraphTreeItem);
      if (!item) { warnNoTreeSelection("change"); return; }
      const targetView = item.node.archived ? deps.archiveView : deps.changesView;
      if (!targetView) { warnNoWorkspace(); return; }
      try {
        const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
        const list = item.node.archived ? workspace.archivedChanges : workspace.changes;
        const found = list.find((change) => change.name === item.node.id);
        if (!found) {
          void vscode.window.showInformationMessage(
            `OpenSpec UI: ${item.node.id} is no longer ${item.node.archived ? "archived" : "active"} — `
            + "it may have been archived, restored, or deleted since the graph was last read.",
          );
          return;
        }
        const changeItem = new ChangeTreeItem(found.name, found.path, found.state, found.artifacts, item.node.archived);
        await targetView.reveal(changeItem, { select: true, focus: true, expand: true });
      } catch (error) {
        await showCommandError("reveal in Changes", error);
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
    vscode.commands.registerCommand("openspec-ui.runTypecheck", () => runCheckCommand(deps, "typecheck")),
    vscode.commands.registerCommand("openspec-ui.runTest", () => runCheckCommand(deps, "test")),
    vscode.commands.registerCommand("openspec-ui.runLint", () => runCheckCommand(deps, "lint")),
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
