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
      "openspec-ui.copyTasksAsTemplate",
      "openspec-ui.customizeTemplate",
      "openspec-ui.insertTemplateIntoChange",
    ]) {
      assert.ok(commands.includes(id), `command ${id} was not registered`);
    }
  });

  test("runners are built from the default agent registry once a workspace is open", () => {
    const runners = api.getRunners();
    assert.ok(runners, "expected a runners map once a workspace is open");
    for (const id of ["claude-cli", "copilot-cli", "codex-cli", "gemini-cli", "local-llm"]) {
      assert.ok(runners.has(id), `expected a runner for ${id}`);
    }
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

  test("Changes tree: tasks.md's checklist items nest under the Tasks artifact, not flat under the Change", async () => {
    // Live regression coverage for a bug reported twice against unit
    // tests alone: unit tests with a mocked `vscode` module can assert a
    // getChildren() return value is structurally correct, but they can't
    // catch "the fix doesn't actually change what a real VS Code window
    // renders." This drives the real ChangesTreeProvider, registered
    // against the real fixture workspace (openspec/changes/demo, with a
    // real tasks.md), inside a real Extension Host.
    assert.ok(api.changesTree, "expected changesTree to be registered for a workspace with openspec/");
    const roots = await api.changesTree.getChildren();
    const change = roots.find((item) => item.label === "demo");
    assert.ok(change, `expected a "demo" change among root items, got: ${roots.map((r) => r.label).join(", ")}`);

    const changeChildren = await api.changesTree.getChildren(change);
    const tasksArtifact = changeChildren.find((item) => item.label === "Tasks");
    assert.ok(tasksArtifact, `expected a "Tasks" artifact among Change children, got: ${changeChildren.map((c) => c.label).join(", ")}`);
    assert.equal(
      changeChildren.some((item) => item.contextValue === "openspec-ui.activeTask" || item.contextValue === "openspec-ui.activeTaskDone"),
      false,
      "task checklist items must not appear flat under the Change itself",
    );
    assert.equal(
      tasksArtifact.collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
      "the Tasks artifact must be collapsible — it has real children now",
    );

    const taskItems = await api.changesTree.getChildren(tasksArtifact);
    assert.ok(
      taskItems.some((item) => item.label === "1.1 Placeholder task."),
      `expected the fixture's checklist item nested under Tasks, got: ${taskItems.map((t) => t.label).join(", ")}`,
    );
  });

  test("Templates tree: built-in templates are grouped by category, not flat under Built-in", async () => {
    // Built-in templates are a static in-code catalog (not workspace-
    // dependent), so this drives the real TemplatesTreeProvider against
    // this extension's actual built-in catalog, inside a real Extension
    // Host — the same "live, not mocked" coverage as the Changes tree
    // test above.
    assert.ok(api.templatesTree, "expected templatesTree to be registered for a workspace with openspec/");
    const roots = await api.templatesTree.getChildren();
    const builtInGroup = roots.find((item) => item.label === "Built-in");
    assert.ok(builtInGroup, `expected a "Built-in" group among root items, got: ${roots.map((r) => r.label).join(", ")}`);

    const categoryGroups = await api.templatesTree.getChildren(builtInGroup);
    assert.ok(
      categoryGroups.every((item) => item.contextValue === "openspec-ui.templateCategoryGroup"),
      `expected every child of Built-in to be a category subgroup, got contextValues: ${categoryGroups.map((c) => c.contextValue).join(", ")}`,
    );
    const categoryLabels = categoryGroups.map((item) => item.label);
    assert.deepEqual(
      categoryLabels,
      [...categoryLabels].sort((a, b) => String(a).localeCompare(String(b))),
      "category subgroups must be sorted alphabetically",
    );
    assert.ok(categoryLabels.includes("testing"), `expected a "testing" category subgroup, got: ${categoryLabels.join(", ")}`);
    assert.equal(
      categoryGroups.some((item) => item.contextValue === "openspec-ui.builtInTemplate"),
      false,
      "templates must not appear as direct children of the Built-in group",
    );

    const testingGroup = categoryGroups.find((item) => item.label === "testing");
    assert.ok(testingGroup, "expected to find the testing category subgroup");
    const testingTemplates = await api.templatesTree.getChildren(testingGroup);
    assert.ok(
      testingTemplates.every((item) => item.contextValue === "openspec-ui.builtInTemplate"),
      `expected only templates under the testing subgroup, got contextValues: ${testingTemplates.map((t) => t.contextValue).join(", ")}`,
    );
    assert.ok(
      testingTemplates.some((item) => item.label === "Add a Vitest + ESLint testing baseline to a Node.js/TypeScript project"),
      `expected the Vitest testing template under the testing subgroup, got: ${testingTemplates.map((t) => t.label).join(", ")}`,
    );
  });

  test("mode-toggle: enabling the localhost setting starts the same server/standalone bundle used by standalone-app", async () => {
    const config = vscode.workspace.getConfiguration("openspec-ui");

    try {
      await config.update("transport.localServer.enabled", true, vscode.ConfigurationTarget.Global);
      // `onDidChangeConfiguration` in extension.ts starts the server
      // asynchronously — wait for it to actually come up (polling for no
      // more than a couple of seconds).
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
