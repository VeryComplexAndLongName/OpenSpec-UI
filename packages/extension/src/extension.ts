// Entry point for the VS Code extension. The primary mode is a direct
// import of `@openspec-ui/core` + a message bridge to the Webview, with no
// network involved (see ADR 0001 item 2 and
// openspec/changes/vscode-extension/design.md).

import * as vscode from "vscode";
import type { AgentRunner } from "@openspec-ui/core";
import {
  HarnessChainRunner,
  WorkbenchProcessScheduler,
  WorkbenchRunJournal,
  WorkspaceLeaseManager,
  buildDefaultAgentRunners,
  resolveRunner as resolveAgentRunner,
} from "@openspec-ui/core";
import { getWorkspaceRoot, readConfig } from "./config.js";
import { RunController } from "./run-controller.js";
import { RunCompletionNotifier, describeRunCompletion } from "./run-notifications.js";
import { registerCommands } from "./commands.js";
import type { TreeSelectionView } from "./commands.js";
import { ChangesTreeProvider } from "./tree/changes-tree.js";
import { ArchiveTreeProvider } from "./tree/archive-tree.js";
import { SpecsTreeProvider } from "./tree/specs-tree.js";
import { ProcessesTreeProvider } from "./tree/processes-tree.js";
import { TemplatesTreeProvider } from "./tree/templates-tree.js";
import { ImplementationSessionManager } from "./implementation-sessions.js";
import { registerOpenSpecChatParticipant } from "./chat-participant.js";
import { AiPanel } from "./webview/ai-panel.js";
import type { AiPanelContext } from "./webview/ai-panel.js";
import { OptionalServerManager } from "./optional-server.js";
import { recoveryDisabledMessage } from "./recovery-diagnostics.js";

let runners: Map<string, AgentRunner> | undefined;
let optionalServer: OptionalServerManager | undefined;

/** Exported via `vscode.extensions.getExtension(...).exports` — for
 * integration tests only (src/test/suite), not a public API. */
export interface ExtensionTestApi {
  getRunners: () => Map<string, AgentRunner> | undefined;
  runController: RunController;
  optionalServer: OptionalServerManager | undefined;
  getDashboardContext: () => AiPanelContext | undefined;
  changesTree: ChangesTreeProvider | undefined;
  templatesTree: TemplatesTreeProvider | undefined;
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
  // The three views whose rows the item-scoped commands act on:
  // `createTreeView` returns a handle exposing `selection`, which
  // `registerTreeDataProvider` does not, and the Command Palette (which
  // passes no item) needs it to find the row the user highlighted.
  // `openspecUiSpecs`/`openspecUiProcesses` stay on
  // `registerTreeDataProvider` — no command reads their selection.
  let changesView: TreeSelectionView | undefined;
  let archiveView: TreeSelectionView | undefined;
  let templatesView: TreeSelectionView | undefined;
  if (workspaceRoot) {
    changesTree = new ChangesTreeProvider(workspaceRoot);
    archiveTree = new ArchiveTreeProvider(workspaceRoot);
    specsTree = new SpecsTreeProvider(workspaceRoot);
    templatesTree = new TemplatesTreeProvider(workspaceRoot);
    const changesTreeView = vscode.window.createTreeView("openspecUiChanges", { treeDataProvider: changesTree });
    const archiveTreeView = vscode.window.createTreeView("openspecUiArchive", { treeDataProvider: archiveTree });
    const templatesTreeView = vscode.window.createTreeView("openspecUiTemplates", { treeDataProvider: templatesTree });
    changesView = changesTreeView;
    archiveView = archiveTreeView;
    templatesView = templatesTreeView;
    context.subscriptions.push(
      changesTreeView,
      archiveTreeView,
      templatesTreeView,
      vscode.window.registerTreeDataProvider("openspecUiSpecs", specsTree),
      vscode.commands.registerCommand("openspec-ui.refresh", () => {
        changesTree?.refresh();
        archiveTree?.refresh();
        specsTree?.refresh();
        templatesTree?.refresh();
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

    runners = buildDefaultAgentRunners({ workspaceRoot });
  } else {
    void vscode.window.showWarningMessage("OpenSpec UI: no folder open — open a workspace to use it.");
  }

  // One `HarnessChainRunner` for the extension host's lifetime — a chain
  // is stateful (a paused checkpoint lives between webview messages, see
  // harness-chain-runner.ts), so it must be reused across every message,
  // not reconstructed per command. `runners` resolves lazily the same way
  // `resolveRunner` above does — there is no workspace-independent set of
  // agents to bind at construction time.
  const chainRunner = new HarnessChainRunner({
    resolveRunner: (agentId) => (runners ? resolveAgentRunner(runners, agentId) : undefined),
  });

  const aiPanel = new AiPanel({
    extensionUri: context.extensionUri,
    runController,
    resolveRunner: (agentId) => (runners ? resolveAgentRunner(runners, agentId) : undefined),
    chainRunner,
    getLocalServerUrl: () => optionalServer?.launchUrl,
    scheduler,
  });

  registerCommands(context, {
    getWorkspaceRoot,
    runController,
    outputChannel,
    revealAiPanel: (panelContext) => aiPanel.reveal(panelContext),
    refreshTrees: () => {
      changesTree?.refresh();
      archiveTree?.refresh();
      specsTree?.refresh();
    },
    refreshTemplatesTree: () => templatesTree?.refresh(),
    scheduler,
    implementationSessions,
    changesView,
    archiveView,
    templatesView,
  });
  registerOpenSpecChatParticipant(context, { getWorkspaceRoot });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (!e.affectsConfiguration("openspec-ui.transport.localServer.enabled") || !optionalServer) return;
      if (readConfig().localServerEnabled) {
        await optionalServer.start();
      } else {
        await optionalServer.stop();
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
  };
}

export async function deactivate(): Promise<void> {
  await optionalServer?.stop();
}
