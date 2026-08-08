// Точка входа расширения VS Code. Основной режим — прямой импорт
// `@openspec-ui/core` + message bridge к Webview, без сети (см. ADR 0001
// п.2 и openspec/changes/vscode-extension/design.md).

import * as vscode from "vscode";
import type { AgentRunner } from "@openspec-ui/core";
import { WorkbenchProcessScheduler } from "@openspec-ui/core";
import { getWorkspaceRoot, readConfig } from "./config.js";
import { RunController } from "./run-controller.js";
import { registerCommands } from "./commands.js";
import { ChangesTreeProvider } from "./tree/changes-tree.js";
import { ArchiveTreeProvider } from "./tree/archive-tree.js";
import { SpecsTreeProvider } from "./tree/specs-tree.js";
import { ProcessesTreeProvider } from "./tree/processes-tree.js";
import { ImplementationSessionManager } from "./implementation-sessions.js";
import { registerOpenSpecChatParticipant } from "./chat-participant.js";
import { AiPanel } from "./webview/ai-panel.js";
import { OptionalServerManager } from "./optional-server.js";

let runners: Map<string, AgentRunner> | undefined;
let optionalServer: OptionalServerManager | undefined;

/** Экспортируется через `vscode.extensions.getExtension(...).exports` —
 * только для интеграционных тестов (src/test/suite), не публичный API. */
export interface ExtensionTestApi {
  getRunners: () => Map<string, AgentRunner> | undefined;
  runController: RunController;
  optionalServer: OptionalServerManager | undefined;
}

export function activate(context: vscode.ExtensionContext): ExtensionTestApi {
  const outputChannel = vscode.window.createOutputChannel("OpenSpec UI");
  context.subscriptions.push(outputChannel);

  const runController = new RunController();
  const scheduler = new WorkbenchProcessScheduler();
  const implementationSessions = new ImplementationSessionManager(scheduler);
  const processesTree = new ProcessesTreeProvider(scheduler);
  context.subscriptions.push(
    processesTree,
    vscode.window.registerTreeDataProvider("openspecUiProcesses", processesTree),
  );

  let changesTree: ChangesTreeProvider | undefined;
  let archiveTree: ArchiveTreeProvider | undefined;
  let specsTree: SpecsTreeProvider | undefined;
  const workspaceRoot = getWorkspaceRoot();
  if (workspaceRoot) {
    changesTree = new ChangesTreeProvider(workspaceRoot);
    archiveTree = new ArchiveTreeProvider(workspaceRoot);
    specsTree = new SpecsTreeProvider(workspaceRoot);
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider("openspecUiChanges", changesTree),
      vscode.window.registerTreeDataProvider("openspecUiArchive", archiveTree),
      vscode.window.registerTreeDataProvider("openspecUiSpecs", specsTree),
      vscode.commands.registerCommand("openspec-ui.refresh", () => {
        changesTree?.refresh();
        archiveTree?.refresh();
        specsTree?.refresh();
      }),
    );
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, "openspec/**"),
    );
    const refreshTrees = () => {
      changesTree?.refresh();
      archiveTree?.refresh();
      specsTree?.refresh();
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
  } else {
    void vscode.window.showWarningMessage("OpenSpec UI: no folder open — open a workspace to use it.");
  }

  const aiPanel = new AiPanel({
    extensionUri: context.extensionUri,
    runController,
    resolveRunner: () => undefined,
    getLocalServerUrl: () => optionalServer?.baseUrl,
  });

  registerCommands(context, {
    getWorkspaceRoot,
    runController,
    outputChannel,
    revealAiPanel: () => aiPanel.reveal(),
    refreshTrees: () => {
      changesTree?.refresh();
      archiveTree?.refresh();
      specsTree?.refresh();
    },
    scheduler,
    implementationSessions,
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

  return { getRunners: () => runners, runController, optionalServer };
}

export async function deactivate(): Promise<void> {
  await optionalServer?.stop();
}
