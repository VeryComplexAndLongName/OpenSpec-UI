// 3.1 Opens spec/proposal documents with VS Code's native editor —
// `webui` does not edit markdown itself in extension mode (see shared-ui
// design.md, "Decisions").

import * as vscode from "vscode";

export async function openDocument(filePath: string): Promise<void> {
  await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(filePath));
}
