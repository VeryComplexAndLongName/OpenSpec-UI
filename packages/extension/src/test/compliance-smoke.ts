import assert from "node:assert/strict";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("openspec-ui.openspec-ui-vscode");
  assert.ok(extension, "The development extension is installed");
  await extension.activate();
  assert.ok((await vscode.commands.getCommands()).includes("openspec-ui.showCompliance"));
  const tab = await new Promise<vscode.Tab>((resolve, reject) => {
    const find = () => vscode.window.tabGroups.all.flatMap(group => group.tabs).find(tab => tab.label === "Compliance");
    const timeout = setTimeout(() => { listener.dispose(); reject(new Error("Compliance tab was not published within 10 seconds")); }, 10_000);
    const listener = vscode.window.tabGroups.onDidChangeTabs(() => {
      const tab = find();
      if (tab) { clearTimeout(timeout); listener.dispose(); resolve(tab); }
    });
    void vscode.commands.executeCommand("openspec-ui.showCompliance").then(() => {
      const tab = find();
      if (tab) { clearTimeout(timeout); listener.dispose(); resolve(tab); }
    }, error => { clearTimeout(timeout); listener.dispose(); reject(error); });
  });
  await vscode.window.tabGroups.close(tab);
  console.log("Compliance live smoke passed: activation, command, panel tab and disposal");
}