// 1.1 Регистрация команд Command Palette (`openspec.plan`/`implement`/
// `review`/`status`/`cancel`, контрибьютятся как `openspec-ui.*` — см.
// package.json `contributes.commands`).

import path from "node:path";
import * as vscode from "vscode";
import {
  listChanges,
  listSpecs,
  showChange,
  validateChange,
  type AgentRunner,
  type Command,
  type CommandKind,
  type OpenSpecShowResult,
  type OpenSpecValidateResult,
} from "@openspec-ui/core";
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
    vscode.commands.registerCommand("openspec-ui.openspecView", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) {
        void vscode.window.showErrorMessage("OpenSpec UI: open a folder or workspace first.");
        return;
      }
      const terminal = vscode.window.createTerminal({ name: "OpenSpec UI: openspec view", cwd: workspaceRoot });
      terminal.show(true);
      terminal.sendText("openspec view", true);
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
