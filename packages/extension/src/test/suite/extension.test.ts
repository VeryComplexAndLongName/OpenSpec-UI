// Живой прогон внутри реального VS Code (Extension Development Host, не
// мок) — tasks.md 4.1 (primary mode, plan/implement с реальным CLI-агентом)
// и 4.2 (переключение на локальный сервер). Результаты и покрытие живыми
// агентами — см. TEST-NOTES.md.

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
      "openspec-ui.plan",
      "openspec-ui.implement",
      "openspec-ui.review",
      "openspec-ui.status",
      "openspec-ui.cancel",
      "openspec-ui.openAiPanel",
      "openspec-ui.refresh",
      "openspec-ui.reviewDiff",
    ]) {
      assert.ok(commands.includes(id), `command ${id} was not registered`);
    }
  });

  test("runners are built for the direct-import (primary) mode", () => {
    const runners = api.getRunners();
    assert.ok(runners, "runners map was not created — no workspace open?");
    for (const id of ["claude-cli", "copilot-cli", "codex-cli", "gemini-cli", "local-llm"]) {
      assert.ok(runners.has(id), `expected runner "${id}" to be registered`);
    }
  });

  test("optional local server is NOT running by default (primary mode is serverless)", () => {
    assert.equal(api.optionalServer?.isRunning ?? false, false);
  });

  test("runs a real `plan` command through copilot-cli and observes a real event stream", async function () {
    // GitHub Copilot CLI — единственный реально авторизованный агент в этом
    // окружении на момент теста (см. TEST-NOTES.md, standalone-app's
    // smoke-test-notes.md за тем же наблюдением). Claude CLI установлен, но
    // не авторизован здесь.
    const config = vscode.workspace.getConfiguration("openspec-ui");
    await config.update("agent.defaultId", "copilot-cli", vscode.ConfigurationTarget.Global);

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
      await vscode.commands.executeCommand("openspec-ui.plan");
    } finally {
      unsubscribe();
      vscode.window.showQuickPick = originalShowQuickPick;
      await config.update("agent.defaultId", undefined, vscode.ConfigurationTarget.Global);
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
