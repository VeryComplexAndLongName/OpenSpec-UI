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
  type Command,
  type OpenSpecShowResult,
  type OpenSpecValidateResult,
} from "@openspec-ui/core";
import type { RunController } from "./run-controller.js";
import { describeEvent } from "./describe-event.js";
import { openDiffAgainstHead } from "./native/diff.js";
import type { ChangeTreeItem } from "./tree/changes-tree.js";

export interface CommandsDeps {
  getWorkspaceRoot: () => string | undefined;
  runController: RunController;
  outputChannel: vscode.OutputChannel;
  revealAiPanel: () => void;
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
  context.subscriptions.push(
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
      deps.revealAiPanel();

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
