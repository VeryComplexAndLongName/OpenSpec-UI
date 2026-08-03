// Точка входа расширения VS Code.
//
// Реализация по openspec/changes/vscode-extension/tasks.md. Планируемый
// состав: tree-providers/{Changes,Archive,Specs}.ts, webview/AiPanel.ts
// (MessageBridgeTransport), commands.ts (регистрация openspec-ui.* команд,
// см. contributes.commands в package.json), optional-server.ts (спавн
// @openspec-ui/server по настройке, динамический порт, cleanup).
//
// Пока не реализовано.
export function activate(): void {
  // TODO: см. tasks.md
}

export function deactivate(): void {
  // TODO: cleanup опционального локального сервера, если запущен
}
