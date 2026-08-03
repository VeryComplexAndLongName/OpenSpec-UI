// 3.3 Встроенный Git API вместо своего git UI — только то, что нужно для
// диффа (3.2): получение виртуального URI файла на ревизии `HEAD` через
// встроенное расширение `vscode.git`.

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
