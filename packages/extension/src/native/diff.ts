// 3.2 Opens a diff via `vscode.diff` — `webui`'s own diff renderer
// (`ChangeDiff`) is not used at all in extension mode (see spec.md,
// "Native diff UI is used for review").

import * as vscode from "vscode";
import { getGitExtensionExports } from "./git.js";

export async function openDiffAgainstHead(fileUri: vscode.Uri, title: string): Promise<void> {
  const git = await getGitExtensionExports();
  if (!git) {
    // No built-in git extension (or the repository is not initialized) —
    // just open the file instead of failing the command.
    await vscode.commands.executeCommand("vscode.open", fileUri);
    return;
  }
  const headUri = git.toGitUri(fileUri, "HEAD");
  await vscode.commands.executeCommand("vscode.diff", headUri, fileUri, title);
}
