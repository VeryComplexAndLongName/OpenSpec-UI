// 3.3 Uses the built-in Git API instead of a custom git UI — only what is
// needed for the diff (3.2): obtaining a file's virtual URI at the `HEAD`
// revision through the built-in `vscode.git` extension.

import * as vscode from "vscode";

export interface GitExtensionExports {
  getAPI(version: 1): { repositories: unknown[] };
  toGitUri(uri: vscode.Uri, ref: string): vscode.Uri;
}

export async function getGitExtensionExports(): Promise<GitExtensionExports | undefined> {
  const ext = vscode.extensions.getExtension<GitExtensionExports>("vscode.git");
  if (!ext) return undefined;
  return ext.isActive ? ext.exports : await ext.activate();
}
