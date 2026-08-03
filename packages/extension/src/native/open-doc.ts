// 3.1 Открытие spec/proposal-документов нативным редактором VS Code —
// `webui` в extension-режиме сам markdown не редактирует (см. shared-ui
// design.md, "Decisions").

import * as vscode from "vscode";

export async function openDocument(filePath: string): Promise<void> {
  await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(filePath));
}
