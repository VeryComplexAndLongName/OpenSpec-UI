// Live run inside real VS Code (Extension Development Host) for direct
// OpenSpec mode and optional local-server toggle.

import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import type { ExtensionTestApi } from "../../extension.js";

function getExtension(): vscode.Extension<ExtensionTestApi> {
  const found = vscode.extensions.all.find((e) => e.packageJSON.name === "openspec-ui-vscode");
  assert.ok(found, "openspec-ui-vscode extension not found among loaded extensions");
  return found as vscode.Extension<ExtensionTestApi>;
}

suite("openspec-ui-vscode — primary mode (message bridge, no local server)", () => {
  let api: ExtensionTestApi;

  suiteSetup(async () => {
    const ext = getExtension();
    api = ext.isActive ? ext.exports : await ext.activate();
  });

  test("activates and registers all contributed commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of [
      "openspec-ui.status",
      "openspec-ui.openAiPanel",
      "openspec-ui.refresh",
      "openspec-ui.reviewDiff",
    ]) {
      assert.ok(commands.includes(id), `command ${id} was not registered`);
    }
  });

  test("runners are not required in direct OpenSpec mode", () => {
    const runners = api.getRunners();
    assert.ok(runners === undefined || runners.size === 0);
  });

  test("optional local server is NOT running by default (primary mode is serverless)", () => {
    assert.equal(api.optionalServer?.isRunning ?? false, false);
  });

  test("opens the context-aware Process Dashboard webview", async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, "no workspace folder open for the integration test");
    await vscode.commands.executeCommand("openspec-ui.openAiPanel");
    const dashboardContext = api.getDashboardContext();
    assert.equal(dashboardContext?.cwd, workspaceFolder.uri.fsPath);
    assert.equal(
      dashboardContext?.changeDir,
      vscode.Uri.joinPath(workspaceFolder.uri, "openspec", "changes").fsPath,
    );
  });

  test("runs a real `status` command and observes a terminal event stream", async function () {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, "no workspace folder open for the integration test");

    const originalShowQuickPick = vscode.window.showQuickPick;
    vscode.window.showQuickPick = (async (items: readonly { label: string }[]) => {
      return items.find((i) => i.label === "demo") ?? items[0];
    }) as unknown as typeof vscode.window.showQuickPick;

    const events: string[] = [];
    const unsubscribe = api.runController.onEvent((event) => {
      events.push(event.kind);
    });

    try {
      await vscode.commands.executeCommand("openspec-ui.status");
    } finally {
      unsubscribe();
      vscode.window.showQuickPick = originalShowQuickPick;
    }

    assert.ok(events.includes("started"), `expected a "started" event, got: ${events.join(", ")}`);
    assert.ok(
      events.includes("completed") || events.includes("failed"),
      `expected a terminal event, got: ${events.join(", ")}`,
    );
  });

  test("mode-toggle: enabling the localhost setting starts the same server/standalone bundle used by standalone-app", async () => {
    const config = vscode.workspace.getConfiguration("openspec-ui");

    try {
      await config.update("transport.localServer.enabled", true, vscode.ConfigurationTarget.Global);
      // `onDidChangeConfiguration` в extension.ts запускает сервер асинхронно —
      // ждём, пока он реально поднимется (без опроса дольше пары секунд).
      const deadline = Date.now() + 5000;
      while (!api.optionalServer?.isRunning && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(api.optionalServer?.isRunning, true, "local server did not start after enabling the setting");

      const baseUrl = api.optionalServer?.baseUrl;
      assert.ok(baseUrl, "local server has no base URL");
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);
      const body = await res.text();
      assert.ok(body.includes('<div id="root">'), "expected the same standalone shell markup as standalone-app");
    } finally {
      await config.update("transport.localServer.enabled", false, vscode.ConfigurationTarget.Global);
      const deadline = Date.now() + 5000;
      while (api.optionalServer?.isRunning && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    assert.equal(api.optionalServer?.isRunning ?? false, false, "local server did not stop after disabling the setting");
  });
});
