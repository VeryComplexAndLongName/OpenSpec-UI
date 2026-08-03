// Чтение настроек расширения (`contributes.configuration` в package.json).

import * as vscode from "vscode";

export interface ExtensionConfig {
  /** `openspec-ui.transport.localServer.enabled` — опциональный режим
   * локального сервера, по умолчанию выключен (см. spec.md, "Localhost
   * server mode is optional and opt-in"). */
  localServerEnabled: boolean;
  defaultAgentId: string;
  localLlmBaseUrl?: string;
  localLlmModel?: string;
}

export function readConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration("openspec-ui");
  return {
    localServerEnabled: config.get<boolean>("transport.localServer.enabled", false),
    defaultAgentId: config.get<string>("agent.defaultId", "claude-cli"),
    localLlmBaseUrl: config.get<string>("agent.localLlm.baseUrl") || undefined,
    localLlmModel: config.get<string>("agent.localLlm.model") || undefined,
  };
}

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
