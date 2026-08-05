// Точка входа расширения VS Code. Основной режим — прямой импорт
// `@openspec-ui/core` + message bridge к Webview, без сети (см. ADR 0001
// п.2 и openspec/changes/vscode-extension/design.md).

import * as vscode from "vscode";
import type { AgentRunner } from "@openspec-ui/core";
import { getWorkspaceRoot, readConfig } from "./config.js";
import { RunController } from "./run-controller.js";
import { registerCommands } from "./commands.js";
import { ChangesTreeProvider } from "./tree/changes-tree.js";
import { ArchiveTreeProvider } from "./tree/archive-tree.js";
import { SpecsTreeProvider } from "./tree/specs-tree.js";
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

  const workspaceRoot = getWorkspaceRoot();
  if (workspaceRoot) {
    const changesTree = new ChangesTreeProvider(workspaceRoot);
    const archiveTree = new ArchiveTreeProvider(workspaceRoot);
    const specsTree = new SpecsTreeProvider(workspaceRoot);
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider("openspecUiChanges", changesTree),
      vscode.window.registerTreeDataProvider("openspecUiArchive", archiveTree),
      vscode.window.registerTreeDataProvider("openspecUiSpecs", specsTree),
      vscode.commands.registerCommand("openspec-ui.refresh", () => {
        changesTree.refresh();
        archiveTree.refresh();
        specsTree.refresh();
      }),
    );

    optionalServer = new OptionalServerManager(workspaceRoot);
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
  });

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
