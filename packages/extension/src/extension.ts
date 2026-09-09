// Entry point for the VS Code extension. The primary mode is a direct
// import of `@openspec-ui/core` + a message bridge to the Webview, with no
// network involved (see ADR 0001 item 2 and
// openspec/changes/vscode-extension/design.md).

import * as vscode from "vscode";
import type { AgentRunner, Command, Event } from "@openspec-ui/core";
import {
  CHECK_SCRIPT_NAMES,
  FileAuditLog,
  HarnessChainRunner,
  WorkbenchProcessScheduler,
  WorkbenchRunJournal,
  WorkspaceLeaseManager,
  auditLogPath,
  buildDefaultAgentRunners,
  resolveCheckScripts,
  resolveRunner as resolveAgentRunner,
} from "@openspec-ui/core";
import { buildChainRunnerAuditDeps } from "./chain-runner-audit-deps.js";
import { getWorkspaceRoot, readConfig } from "./config.js";
import { RunController } from "./run-controller.js";
import { RunCompletionNotifier, describeRunCompletion } from "./run-notifications.js";
import { createRunChoiceHandler, registerCommands, type CommandsDeps } from "./commands.js";
import type { RevealableTreeView, TreeSelectionView } from "./commands.js";
import { ChangesTreeProvider } from "./tree/changes-tree.js";
import type { ChangeTreeItem } from "./tree/changes-tree.js";
import { ArchiveTreeProvider } from "./tree/archive-tree.js";
import { SpecsTreeProvider } from "./tree/specs-tree.js";
import { ProcessesTreeProvider } from "./tree/processes-tree.js";
import { TemplatesTreeProvider } from "./tree/templates-tree.js";
import { ChangeGraphTreeProvider } from "./tree/change-graph-tree.js";
import type { GraphTreeNode } from "./tree/change-graph-tree.js";
import { HumanOnlyInboxTreeProvider } from "./tree/human-only-inbox-tree.js";
import { registerFollowSelection } from "./follow-selection.js";
import { ImplementationSessionManager } from "./implementation-sessions.js";
import { registerOpenSpecChatParticipant } from "./chat-participant.js";
import { AiPanel } from "./webview/ai-panel.js";
import type { AiPanelContext } from "./webview/ai-panel.js";
import { OptionalServerManager } from "./optional-server.js";
import { recoveryDisabledMessage } from "./recovery-diagnostics.js";

let runners: Map<string, AgentRunner> | undefined;
let auditLog: FileAuditLog | undefined;
let optionalServer: OptionalServerManager | undefined;

/** Sets `openspec-ui.checks.<name>` for each check — the context key
 * package.json's `view/title` and `commandPalette` `when` clauses gate on
 * (task 1.4: a workspace declaring neither `osui-<name>` nor `<name>` must
 * see no command, not a failing one). Re-run on activation, on
 * `openspec-ui.checks` config changes, and whenever the workspace's
 * `package.json` changes — any of the three can change what resolves. */
async function updateCheckContexts(workspaceRoot: string | undefined): Promise<void> {
  const resolved = workspaceRoot ? await resolveCheckScripts(workspaceRoot, readConfig().checks) : {};
  await Promise.all(
    CHECK_SCRIPT_NAMES.map((name) =>
      vscode.commands.executeCommand("setContext", `openspec-ui.checks.${name}`, Boolean(resolved[name])),
    ),
  );
}

/** Exported via `vscode.extensions.getExtension(...).exports` — for
 * integration tests only (src/test/suite), not a public API. */
export interface ExtensionTestApi {
  getRunners: () => Map<string, AgentRunner> | undefined;
  runController: RunController;
  optionalServer: OptionalServerManager | undefined;
  getDashboardContext: () => AiPanelContext | undefined;
  changesTree: ChangesTreeProvider | undefined;
  templatesTree: TemplatesTreeProvider | undefined;
  /** Test-only in intent, real API in effect: delivers `command` to the
   * AI panel through the exact same handler a real webview message
   * reaches (`AiPanel.deliverWebviewCommandForTesting()`), so an
   * integration test exercises the actual webview → extension routing
   * (including the `vscode-chat` step-agent dispatch) instead of a
   * shortcut around it. Deliberately does NOT expose `AiPanel` itself or
   * its private `dispatchToChat()` — see
   * openspec/changes/dispatch-to-chat-integration-coverage/proposal.md.
   * No-op if the AI panel has never been revealed. */
  deliverWebviewCommand: (command: Command) => void;
  /** The receiving half of `deliverWebviewCommand` above: observes every
   * `"openspec-ui/event"` message the AI panel posts back to the webview
   * (`AiPanel.onWebviewEventForTesting()`) — the wire-level artifact a
   * real webview's own `window.addEventListener("message", ...)` would
   * see, not a hook into `AiPanel`'s internals. Needed so an integration
   * test can assert ADR 0016's `started` → `handedOff` event sequence
   * for a `vscode-chat` dispatch, which never reaches
   * `runController.onEvent` (see ai-panel.ts's `dispatchToChat()` header
   * comment — nothing observes the chat session's work through the
   * ordinary runner path). Returns a `Disposable` that stops observing;
   * works whether registered before or after the AI panel has been
   * revealed. */
  onWebviewEvent: (listener: (event: Event) => void) => vscode.Disposable;
}

export async function activate(context: vscode.ExtensionContext): Promise<ExtensionTestApi> {
  const outputChannel = vscode.window.createOutputChannel("OpenSpec UI");
  context.subscriptions.push(outputChannel);

  const runController = new RunController();
  const workspaceRoot = getWorkspaceRoot();
  let journal: WorkbenchRunJournal | undefined;
  let restoredRuns = { processes: [], checkpointSessions: [] } as Awaited<ReturnType<WorkbenchRunJournal["load"]>>;
  if (workspaceRoot) {
    journal = new WorkbenchRunJournal(workspaceRoot);
    try {
      restoredRuns = await journal.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Run recovery disabled: ${message}`);
      void vscode.window.showErrorMessage(recoveryDisabledMessage(error));
      journal = undefined;
    }
  }
  const lease = workspaceRoot
    ? new WorkspaceLeaseManager(workspaceRoot, { hostKind: "vscode-extension" })
    : undefined;
  const scheduler = new WorkbenchProcessScheduler(restoredRuns.processes, lease);
  const persistRuns = () => {
    if (!journal) return;
    void journal.save({
      processes: scheduler.list(),
      checkpointSessions: implementationSessions.exportPersisted(),
    }).catch((error: unknown) => {
      outputChannel.appendLine(`Run journal write failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  };
  const implementationSessions = new ImplementationSessionManager(scheduler, persistRuns);
  context.subscriptions.push({ dispose: scheduler.onDidChange(persistRuns) });
  // Startup reads checkpoint payloads only for interrupted sessions that
  // still lack a persisted delta; all other restored sessions keep a
  // lazy reference and resolve on first details/rollback request.
  await implementationSessions.restore(restoredRuns.checkpointSessions);

  // Notify when a plan/implement/review run finishes while the user isn't
  // necessarily watching the Processes view — seeded from the restored
  // journal so processes that were already terminal before this activation
  // (including ones the constructor above just marked "interrupted") never
  // re-fire. See run-notifications.ts for why status/list/show/validate and
  // cancelled/interrupted/rolled-back are excluded.
  const runCompletionNotifier = new RunCompletionNotifier(scheduler.list());
  context.subscriptions.push({
    dispose: scheduler.onDidChange((processes) => {
      for (const process of runCompletionNotifier.handle(processes)) {
        const message = describeRunCompletion(process);
        const show = process.state === "failed" ? vscode.window.showErrorMessage : vscode.window.showInformationMessage;
        void show(message, "View").then((choice) => {
          if (choice === "View") void vscode.commands.executeCommand("openspec-ui.openAiPanel");
        });
      }
    }),
  });

  // Retention (openspec-ui.checkpointRetentionDays): 0 or negative keeps
  // everything forever (default, matches prior behavior — nothing was
  // ever pruned before this setting existed). scheduler.removeBefore's
  // own onDidChange emission (subscribed above) persists the pruned
  // state; no separate persistRuns() call needed here.
  const retentionDays = vscode.workspace.getConfiguration("openspec-ui").get<number>("checkpointRetentionDays", 0);
  if (retentionDays > 0) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    implementationSessions.dropSessions(scheduler.removeBefore(cutoff));
  }
  const processesTree = new ProcessesTreeProvider(scheduler, workspaceRoot ?? "");
  context.subscriptions.push(
    processesTree,
    vscode.window.registerTreeDataProvider("openspecUiProcesses", processesTree),
  );

  let changesTree: ChangesTreeProvider | undefined;
  let archiveTree: ArchiveTreeProvider | undefined;
  let specsTree: SpecsTreeProvider | undefined;
  let templatesTree: TemplatesTreeProvider | undefined;
  let changeGraphTree: ChangeGraphTreeProvider | undefined;
  let humanOnlyInboxTree: HumanOnlyInboxTreeProvider | undefined;
  // The three views whose rows the item-scoped commands act on:
  // `createTreeView` returns a handle exposing `selection`, which
  // `registerTreeDataProvider` does not, and the Command Palette (which
  // passes no item) needs it to find the row the user highlighted.
  // `openspecUiSpecs`/`openspecUiProcesses` stay on
  // `registerTreeDataProvider` — no command reads their selection.
  let changesView: RevealableTreeView<ChangeTreeItem> | undefined;
  let archiveView: RevealableTreeView<ChangeTreeItem> | undefined;
  let templatesView: TreeSelectionView | undefined;
  let changeGraphView: RevealableTreeView<GraphTreeNode> | undefined;
  if (workspaceRoot) {
    changesTree = new ChangesTreeProvider(workspaceRoot);
    archiveTree = new ArchiveTreeProvider(workspaceRoot);
    specsTree = new SpecsTreeProvider(workspaceRoot);
    templatesTree = new TemplatesTreeProvider(workspaceRoot);
    changeGraphTree = new ChangeGraphTreeProvider(workspaceRoot);
    humanOnlyInboxTree = new HumanOnlyInboxTreeProvider(workspaceRoot);
    const changesTreeView = vscode.window.createTreeView("openspecUiChanges", { treeDataProvider: changesTree });
    const archiveTreeView = vscode.window.createTreeView("openspecUiArchive", { treeDataProvider: archiveTree });
    const templatesTreeView = vscode.window.createTreeView("openspecUiTemplates", { treeDataProvider: templatesTree });
    // Was `registerTreeDataProvider` (no command read this view's
    // selection). Reversed here because `reveal` — which
    // `openspec-ui.revealInChangeGraph` and follow-selection both need —
    // lives only on the handle `createTreeView` returns. The rest of the
    // original reasoning is unchanged: this is still revealed *into*, not
    // read from — no mutating command gains a graph entry (design.md,
    // "the graph moves to createTreeView, and what that reverses").
    const changeGraphTreeView = vscode.window.createTreeView("openspecUiChangeGraph", { treeDataProvider: changeGraphTree });
    changesView = changesTreeView;
    archiveView = archiveTreeView;
    templatesView = templatesTreeView;
    changeGraphView = changeGraphTreeView;
    context.subscriptions.push(
      changesTreeView,
      archiveTreeView,
      templatesTreeView,
      changeGraphTreeView,
      vscode.window.registerTreeDataProvider("openspecUiSpecs", specsTree),
      // Read-only, same reasoning as the graph above: no command reads
      // this view's selection, since selecting a row only reveals it in
      // Changes and never mutates it (design.md, "nothing in the inbox
      // marks an item done").
      vscode.window.registerTreeDataProvider("openspecUiHumanOnlyInbox", humanOnlyInboxTree),
      registerFollowSelection({
        getWorkspaceRoot,
        changesView: changesTreeView,
        archiveView: archiveTreeView,
        changeGraphView: changeGraphTreeView,
      }),
      vscode.commands.registerCommand("openspec-ui.refresh", () => {
        changesTree?.refresh();
        archiveTree?.refresh();
        specsTree?.refresh();
        templatesTree?.refresh();
        changeGraphTree?.refresh();
        humanOnlyInboxTree?.refresh();
      }),
    );
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, "openspec/**"),
    );
    const refreshTrees = () => {
      changesTree?.refresh();
      archiveTree?.refresh();
      specsTree?.refresh();
      templatesTree?.refresh();
      changeGraphTree?.refresh();
      humanOnlyInboxTree?.refresh();
    };
    context.subscriptions.push(
      watcher,
      watcher.onDidCreate(refreshTrees),
      watcher.onDidChange(refreshTrees),
      watcher.onDidDelete(refreshTrees),
    );

    optionalServer = new OptionalServerManager(
      workspaceRoot,
      vscode.Uri.joinPath(context.extensionUri, "dist").fsPath,
    );
    if (readConfig().localServerEnabled) {
      void optionalServer.start();
    }

    auditLog = new FileAuditLog(auditLogPath(workspaceRoot));
    runners = buildDefaultAgentRunners({ workspaceRoot, auditLog });

    const packageJsonWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, "package.json"),
    );
    const refreshCheckContexts = () => void updateCheckContexts(workspaceRoot);
    context.subscriptions.push(
      packageJsonWatcher,
      packageJsonWatcher.onDidCreate(refreshCheckContexts),
      packageJsonWatcher.onDidChange(refreshCheckContexts),
      packageJsonWatcher.onDidDelete(refreshCheckContexts),
    );
  } else {
    void vscode.window.showWarningMessage("OpenSpec UI: no folder open — open a workspace to use it.");
  }
  await updateCheckContexts(workspaceRoot);

  // One `HarnessChainRunner` for the extension host's lifetime — a chain
  // is stateful (a paused checkpoint lives between webview messages, see
  // harness-chain-runner.ts), so it must be reused across every message,
  // not reconstructed per command. `runners` resolves lazily the same way
  // `resolveRunner` above does — there is no workspace-independent set of
  // agents to bind at construction time.
  const chainRunner = new HarnessChainRunner({
    resolveRunner: (agentId) => (runners ? resolveAgentRunner(runners, agentId) : undefined),
    // Both audit dependencies come from one place, so that "the chain
    // writes its spend but reads nothing back" cannot be introduced by
    // editing one of two lines. See chain-runner-audit-deps.ts.
    ...buildChainRunnerAuditDeps(auditLog),
  });

  const aiPanel = new AiPanel({
    extensionUri: context.extensionUri,
    runController,
    resolveRunner: (agentId) => (runners ? resolveAgentRunner(runners, agentId) : undefined),
    chainRunner,
    getLocalServerUrl: () => optionalServer?.launchUrl,
    scheduler,
  });

  const commandsDeps = {
    getWorkspaceRoot,
    runController,
    outputChannel,
    revealAiPanel: (panelContext: AiPanelContext | undefined) => aiPanel.reveal(panelContext),
    refreshTrees: () => {
      changesTree?.refresh();
      archiveTree?.refresh();
      specsTree?.refresh();
      changeGraphTree?.refresh();
    },
    refreshTemplatesTree: () => templatesTree?.refresh(),
    scheduler,
    implementationSessions,
    changesView,
    archiveView,
    templatesView,
    changeGraphView,
    // Undefined without an open workspace, where there is nowhere for an
    // audit log to live — the same real case `chain-runner-audit-deps.ts`
    // treats as absent rather than as a reader over nothing.
    ...(auditLog ? { readAuditEntries: () => (auditLog as FileAuditLog).readEntries() } : {}),
  } satisfies CommandsDeps;

  registerCommands(context, commandsDeps);
  // The run dialog lives in the panel now, so the two answers only this
  // host can carry out — opening a chat session, writing a named
  // configuration — come back as messages. The handler is built from the
  // same deps the commands use, because it needs the same things. See
  // run-dialog-in-the-panel.
  aiPanel.onRunChoice((choice, choiceContext) => {
    void createRunChoiceHandler(commandsDeps)(choice, choiceContext);
  });
  registerOpenSpecChatParticipant(context, { getWorkspaceRoot });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("openspec-ui.transport.localServer.enabled") && optionalServer) {
        if (readConfig().localServerEnabled) {
          await optionalServer.start();
        } else {
          await optionalServer.stop();
        }
      }
      if (e.affectsConfiguration("openspec-ui.checks")) {
        await updateCheckContexts(workspaceRoot);
      }
    }),
  );

  return {
    getRunners: () => runners,
    runController,
    optionalServer,
    getDashboardContext: () => aiPanel.getContext(),
    changesTree,
    templatesTree,
    deliverWebviewCommand: (command) => aiPanel.deliverWebviewCommandForTesting(command),
    onWebviewEvent: (listener) => aiPanel.onWebviewEventForTesting(listener),
  };
}

export async function deactivate(): Promise<void> {
  await optionalServer?.stop();
}
