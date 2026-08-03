// 1.1 Регистрация команд Command Palette (`openspec.plan`/`implement`/
// `review`/`status`/`cancel`, контрибьютятся как `openspec-ui.*` — см.
// package.json `contributes.commands`).

import path from "node:path";
import * as vscode from "vscode";
import { listChanges, type AgentRunner, type Command, type CommandKind } from "@openspec-ui/core";
import type { RunController } from "./run-controller.js";
import type { ExtensionConfig } from "./config.js";
import { describeEvent } from "./describe-event.js";
import { openDiffAgainstHead } from "./native/diff.js";
import type { ChangeTreeItem } from "./tree/changes-tree.js";

export interface CommandsDeps {
  getWorkspaceRoot: () => string | undefined;
  getRunners: () => Map<string, AgentRunner> | undefined;
  getConfig: () => ExtensionConfig;
  runController: RunController;
  outputChannel: vscode.OutputChannel;
  revealAiPanel: () => void;
}

const RUNNABLE_COMMANDS: Record<string, CommandKind> = {
  "openspec-ui.plan": "plan",
  "openspec-ui.implement": "implement",
  "openspec-ui.review": "review",
  "openspec-ui.status": "status",
};

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

export function registerCommands(context: vscode.ExtensionContext, deps: CommandsDeps): void {
  for (const [commandId, kind] of Object.entries(RUNNABLE_COMMANDS)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, async () => {
        const workspaceRoot = deps.getWorkspaceRoot();
        if (!workspaceRoot) {
          void vscode.window.showErrorMessage("OpenSpec UI: open a folder or workspace first.");
          return;
        }
        const runners = deps.getRunners();
        if (!runners) {
          void vscode.window.showErrorMessage("OpenSpec UI: agent runners are not ready yet.");
          return;
        }

        const selected = await pickChange(workspaceRoot);
        if (!selected) return;

        const config = deps.getConfig();
        const command: Command = {
          kind,
          cwd: workspaceRoot,
          runId: crypto.randomUUID(),
          agentId: config.defaultAgentId,
          context: { changeDir: selected.changeDir },
        };
        const runner = runners.get(command.agentId ?? "");
        if (!runner) {
          void vscode.window.showErrorMessage(`OpenSpec UI: unknown agent "${String(command.agentId)}".`);
          return;
        }

        deps.outputChannel.clear();
        deps.outputChannel.show(true);
        deps.revealAiPanel();

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `OpenSpec UI: ${kind} — ${selected.name}`,
            cancellable: true,
          },
          async (_progress, cancelToken) => {
            const unsubscribe = deps.runController.onEvent((event) => {
              deps.outputChannel.appendLine(describeEvent(event));
            });
            const cancelSub = cancelToken.onCancellationRequested(() => {
              deps.runController.cancel();
            });
            try {
              await deps.runController.run(runner, command);
            } finally {
              unsubscribe();
              cancelSub.dispose();
            }
          },
        );
      }),
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.cancel", () => {
      const cancelled = deps.runController.cancel();
      if (!cancelled) {
        void vscode.window.showInformationMessage("OpenSpec UI: no active run to cancel.");
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.openAiPanel", () => {
      deps.revealAiPanel();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.reviewDiff", async (item?: ChangeTreeItem) => {
      if (!item) {
        void vscode.window.showWarningMessage("OpenSpec UI: select a change in the tree first.");
        return;
      }
      const tasksPath = path.join(item.changeDir, "tasks.md");
      await openDiffAgainstHead(
        vscode.Uri.file(tasksPath),
        `${item.changeName}: tasks.md (HEAD ↔ working tree)`,
      );
    }),
  );
}
