// 3.2 Открытие диффа через `vscode.diff` — собственный diff-рендер `webui`
// (`ChangeDiff`) в extension-режиме не используется вовсе (см. spec.md,
// "Native diff UI is used for review").

import * as vscode from "vscode";
import { getGitExtensionExports } from "./git.js";

export async function openDiffAgainstHead(fileUri: vscode.Uri, title: string): Promise<void> {
  const git = await getGitExtensionExports();
  if (!git) {
    // Нет встроенного git-расширения (или репозиторий не инициализирован) —
    // просто открываем файл, не роняя команду.
    await vscode.commands.executeCommand("vscode.open", fileUri);
    return;
  }
  const headUri = git.toGitUri(fileUri, "HEAD");
  await vscode.commands.executeCommand("vscode.diff", headUri, fileUri, title);
}
