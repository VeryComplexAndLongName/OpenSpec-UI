import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const listChangesMock = vi.fn();
const listSpecsMock = vi.fn();
const showChangeMock = vi.fn();
const validateChangeMock = vi.fn();
const archiveChangeMock = vi.fn();
const createChangeMock = vi.fn();
const deleteChangeMock = vi.fn();
const unarchiveChangeMock = vi.fn();
const initOpenSpecMock = vi.fn();
const readArchivedChangeTasksTemplateMock = vi.fn();
const customizeTemplateMock = vi.fn();
const deleteProjectTemplateMock = vi.fn();
const renderTemplateMock = vi.fn();
class TemplateAlreadyExistsError extends Error {}
class UnknownProjectTemplateError extends Error {}
vi.mock("@openspec-ui/core", () => ({
  archiveChange: (...args: unknown[]) => archiveChangeMock(...args),
  createChange: (...args: unknown[]) => createChangeMock(...args),
  customizeTemplate: (...args: unknown[]) => customizeTemplateMock(...args),
  deleteChange: (...args: unknown[]) => deleteChangeMock(...args),
  deleteProjectTemplate: (...args: unknown[]) => deleteProjectTemplateMock(...args),
  initOpenSpec: (...args: unknown[]) => initOpenSpecMock(...args),
  listChanges: (...args: unknown[]) => listChangesMock(...args),
  listSpecs: (...args: unknown[]) => listSpecsMock(...args),
  readArchivedChangeTasksTemplate: (...args: unknown[]) => readArchivedChangeTasksTemplateMock(...args),
  renderTemplate: (...args: unknown[]) => renderTemplateMock(...args),
  showChange: (...args: unknown[]) => showChangeMock(...args),
  TemplateAlreadyExistsError,
  UnknownProjectTemplateError,
  unarchiveChange: (...args: unknown[]) => unarchiveChangeMock(...args),
  validateChange: (...args: unknown[]) => validateChangeMock(...args),
}));

const openDiffAgainstHeadMock = vi.fn();
vi.mock("./native/diff.js", () => ({ openDiffAgainstHead: (...args: unknown[]) => openDiffAgainstHeadMock(...args) }));

const { registerCommands } = await import("./commands.js");
const { RunController } = await import("./run-controller.js");

afterEach(() => {
  vi.clearAllMocks();
  vscodeMock._documentContents.clear();
});

function makeContext() {
  return { subscriptions: [] as Array<{ dispose(): void }> };
}

function makeDeps(overrides: Partial<Parameters<typeof registerCommands>[1]> = {}) {
  const runController = new RunController();
  const outputChannel = { appendLine: vi.fn(), clear: vi.fn(), show: vi.fn() };
  const scheduler = {
    start: vi.fn((options: { execute: (context: { signal: AbortSignal; report: (value: string) => void }) => Promise<unknown> }) => ({
      id: "test-process",
      cancel: vi.fn(),
      completion: options.execute({ signal: new AbortController().signal, report: vi.fn() })
        .then((summary) => ({ state: "completed", summary }))
        .catch((error: unknown) => ({ state: "failed", error: error instanceof Error ? error.message : String(error) })),
    })),
    cancel: vi.fn(),
  };
  const implementationSessions = {
    run: vi.fn(async (_root: string, options: { execute: () => Promise<unknown> }) => {
      try {
        const summary = await options.execute();
        return { state: "completed", summary };
      } catch (error) {
        return { state: "failed", error: error instanceof Error ? error.message : String(error) };
      }
    }),
    start: vi.fn(async () => "implementation-process"),
    finish: vi.fn(() => true),
    cancel: vi.fn(() => true),
    getDelta: vi.fn(() => undefined),
    getCoverage: vi.fn(() => undefined),
    rollback: vi.fn(),
  };
  return {
    getWorkspaceRoot: () => "/workspace/repo",
    runController,
    outputChannel: outputChannel as unknown as import("vscode").OutputChannel,
    revealAiPanel: vi.fn(),
    refreshTrees: vi.fn(),
    refreshTemplatesTree: vi.fn(),
    scheduler: scheduler as unknown as import("@openspec-ui/core").WorkbenchProcessScheduler,
    implementationSessions: implementationSessions as unknown as import("./implementation-sessions.js").ImplementationSessionManager,
    ...overrides,
  };
}

describe("registerCommands", () => {
  it("registers all expected command ids", () => {
    const context = makeContext();
    registerCommands(context as unknown as import("vscode").ExtensionContext, makeDeps());

    const registered = [...vscodeMock._registeredCommands.keys()];
    expect(registered).toEqual(
      expect.arrayContaining([
        "openspec-ui.status",
        "openspec-ui.initialize",
        "openspec-ui.createChange",
        "openspec-ui.validateSelectedChange",
        "openspec-ui.archiveChange",
        "openspec-ui.unarchiveChange",
        "openspec-ui.deleteChange",
        "openspec-ui.openspecView",
        "openspec-ui.showChangeDetails",
        "openspec-ui.validateChangeStrict",
        "openspec-ui.listSpecsSummary",
        "openspec-ui.openAiPanel",
        "openspec-ui.reviewDiff",
      ]),
    );
  });

  it("creates a change and refreshes all trees", async () => {
    vscodeMock.window.showInputBox.mockResolvedValue("new-workbench-change");
    createChangeMock.mockResolvedValue({ ok: true });
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.createChange")?.();

    expect(createChangeMock).toHaveBeenCalledWith("new-workbench-change", { cwd: "/workspace/repo" });
    expect(deps.refreshTrees).toHaveBeenCalled();
  });

  it("archives a confirmed active change and refreshes", async () => {
    vscodeMock.window.showWarningMessage.mockResolvedValue("Archive");
    archiveChangeMock.mockResolvedValue({ ok: true });
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.archiveChange")?.({
      changeName: "done-change",
      archived: false,
    });

    expect(archiveChangeMock).toHaveBeenCalledWith("done-change", { cwd: "/workspace/repo" });
    expect(deps.refreshTrees).toHaveBeenCalled();
  });

  it("unarchives and deletes only after explicit confirmation", async () => {
    vscodeMock.window.showWarningMessage
      .mockResolvedValueOnce("Unarchive")
      .mockResolvedValueOnce("Delete");
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);
    const archivedItem = { changeName: "old-change", archived: true };

    await vscodeMock._registeredCommands.get("openspec-ui.unarchiveChange")?.(archivedItem);
    await vscodeMock._registeredCommands.get("openspec-ui.deleteChange")?.(archivedItem);

    expect(unarchiveChangeMock).toHaveBeenCalledWith("/workspace/repo", "old-change");
    expect(deleteChangeMock).toHaveBeenCalledWith("/workspace/repo", "old-change", "archive");
    expect(deps.refreshTrees).toHaveBeenCalledTimes(2);
  });

  it("openspec-ui.status: picks a change, runs direct OpenSpec status flow, and reveals the panel", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "shared-ui", completedTasks: 1, totalTasks: 17, lastModified: "t", status: "in-progress" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    vscodeMock.window.showQuickPick.mockResolvedValue({ label: "shared-ui", description: "1/17 — in-progress" });

    const deps = makeDeps();
    const runSpy = vi.spyOn(deps.runController, "run");
    const context = makeContext();
    registerCommands(context as unknown as import("vscode").ExtensionContext, deps);

    const handler = vscodeMock._registeredCommands.get("openspec-ui.status");
    await handler?.();

    expect(deps.revealAiPanel).toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledTimes(1);
    const [runnerArg, command] = runSpy.mock.calls[0]!;
    expect(runnerArg).toBeUndefined();
    expect(command).toMatchObject({
      kind: "status",
      cwd: "/workspace/repo",
      context: { changeDir: expect.stringContaining("shared-ui") },
    });
  });

  it("shows an error and does not run anything when no workspace is open", async () => {
    const deps = makeDeps({ getWorkspaceRoot: () => undefined });
    const runSpy = vi.spyOn(deps.runController, "run");
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.status")?.();

    expect(vscodeMock.window.showErrorMessage).toHaveBeenCalled();
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("does nothing further when the user dismisses the QuickPick", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "shared-ui", completedTasks: 1, totalTasks: 17, lastModified: "t", status: "in-progress" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    vscodeMock.window.showQuickPick.mockResolvedValue(undefined);

    const deps = makeDeps();
    const runSpy = vi.spyOn(deps.runController, "run");
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.status")?.();

    expect(runSpy).not.toHaveBeenCalled();
  });

  it("openspec-ui.reviewDiff: warns when invoked without a tree item", async () => {
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
    await vscodeMock._registeredCommands.get("openspec-ui.reviewDiff")?.(undefined);
    expect(vscodeMock.window.showWarningMessage).toHaveBeenCalled();
    expect(openDiffAgainstHeadMock).not.toHaveBeenCalled();
  });

  it("opens the process dashboard with workspace context", async () => {
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.openAiPanel")?.();

    expect(deps.revealAiPanel).toHaveBeenCalledWith({
      cwd: "/workspace/repo",
      changeDir: expect.stringMatching(/workspace[\\/]repo[\\/]openspec[\\/]changes$/),
    });
  });

  it("opens the process dashboard with a selected change directory", async () => {
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.openAiPanel")?.({
      changeName: "shared-ui",
      changeDir: "/workspace/repo/openspec/changes/shared-ui",
    });

    expect(deps.revealAiPanel).toHaveBeenCalledWith({
      cwd: "/workspace/repo",
      changeDir: "/workspace/repo/openspec/changes/shared-ui",
    });
  });

  it("openspec-ui.reviewDiff: diffs tasks.md for the given change item", async () => {
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
    const item = { changeName: "shared-ui", changeDir: "/workspace/repo/openspec/changes/shared-ui" };
    await vscodeMock._registeredCommands.get("openspec-ui.reviewDiff")?.(item);

    expect(openDiffAgainstHeadMock).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: expect.stringContaining("tasks.md") }),
      expect.stringContaining("shared-ui"),
    );
  });

  it("openspec-ui.openspecView: opens terminal and runs openspec view", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "shared-ui", completedTasks: 1, totalTasks: 17, lastModified: "2026-08-05T10:00:00.000Z", status: "in-progress" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    listSpecsMock.mockResolvedValue({
      specs: [{ id: "shared-ui", requirementCount: 5 }],
      root: { path: "/workspace/repo", source: "nearest" },
    });

    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
    await vscodeMock._registeredCommands.get("openspec-ui.openspecView")?.();

    expect(vscodeMock.window.createTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ name: "OpenSpec UI: openspec view", cwd: "/workspace/repo" }),
    );
    const terminal = vscodeMock.window.createTerminal.mock.results[0]?.value;
    expect(terminal.show).toHaveBeenCalled();
    expect(terminal.sendText).toHaveBeenCalledWith("openspec view", true);
    expect(listChangesMock).toHaveBeenCalledWith({ cwd: "/workspace/repo" });
    expect(listSpecsMock).toHaveBeenCalledWith({ cwd: "/workspace/repo" });
    expect(vscodeMock.workspace.openTextDocument).toHaveBeenCalled();
  });

  it("openspec-ui.validateChangeStrict: opens a parsed markdown summary", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "shared-ui", completedTasks: 1, totalTasks: 17, lastModified: "t", status: "in-progress" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    vscodeMock.window.showQuickPick.mockResolvedValue({ label: "shared-ui", description: "1/17 — in-progress" });
    validateChangeMock.mockResolvedValue({
      items: [{ id: "shared-ui", type: "change", valid: true, issues: [], durationMs: 12 }],
      summary: { totals: { items: 1, passed: 1, failed: 0 }, byType: { change: { items: 1, passed: 1, failed: 0 } } },
      version: "1.2.3",
      root: { path: "/workspace/repo", source: "nearest" },
    });

    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
    await vscodeMock._registeredCommands.get("openspec-ui.validateChangeStrict")?.();

    expect(validateChangeMock).toHaveBeenCalledWith("shared-ui", { cwd: "/workspace/repo" });
    expect(vscodeMock.workspace.openTextDocument).toHaveBeenCalled();
    expect(vscodeMock.window.showTextDocument).toHaveBeenCalled();
  });

  describe("openspec-ui.copyTasksAsTemplate", () => {
    it("inserts the archived change's tasks template into the picked target's tasks.md", async () => {
      listChangesMock.mockResolvedValue({
        changes: [{ name: "active-change", completedTasks: 0, totalTasks: 3, lastModified: "t", status: "draft" }],
        root: { path: "/workspace/repo", source: "nearest" },
      });
      vscodeMock.window.showQuickPick.mockResolvedValue({ label: "active-change", description: "0/3 — draft" });
      readArchivedChangeTasksTemplateMock.mockResolvedValue("## 1. From archive\n\n- [ ] step\n");
      const targetPath = path.join("/workspace/repo", "openspec", "changes", "active-change", "tasks.md");
      vscodeMock._documentContents.set(targetPath, "## 1. Existing\n\n- [ ] already here\n");

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.copyTasksAsTemplate")?.({
        changeName: "old-change",
        archived: true,
      });

      expect(readArchivedChangeTasksTemplateMock).toHaveBeenCalledWith("/workspace/repo", "old-change");
      expect(vscodeMock.workspace.applyEdit).toHaveBeenCalled();
      expect(vscodeMock._documentContents.get(targetPath)).toBe(
        "## 1. Existing\n\n- [ ] already here\n\n## 1. From archive\n\n- [ ] step\n",
      );
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalled();
    });

    it("does nothing when invoked on a non-archived item", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.copyTasksAsTemplate")?.({
        changeName: "active-change",
        archived: false,
      });

      expect(vscodeMock.window.showQuickPick).not.toHaveBeenCalled();
      expect(readArchivedChangeTasksTemplateMock).not.toHaveBeenCalled();
    });

    it("reports no valid target instead of offering an empty picker", async () => {
      listChangesMock.mockResolvedValue({ changes: [], root: { path: "/workspace/repo", source: "nearest" } });

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.copyTasksAsTemplate")?.({
        changeName: "old-change",
        archived: true,
      });

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("no changes found"),
      );
      expect(readArchivedChangeTasksTemplateMock).not.toHaveBeenCalled();
    });

    it("does nothing when the user dismisses the target picker", async () => {
      listChangesMock.mockResolvedValue({
        changes: [{ name: "active-change", completedTasks: 0, totalTasks: 3, lastModified: "t", status: "draft" }],
        root: { path: "/workspace/repo", source: "nearest" },
      });
      vscodeMock.window.showQuickPick.mockResolvedValue(undefined);

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.copyTasksAsTemplate")?.({
        changeName: "old-change",
        archived: true,
      });

      expect(readArchivedChangeTasksTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.customizeTemplate", () => {
    const builtInItem = {
      template: {
        origin: "built-in" as const,
        manifest: { id: "seed", title: "Seed", category: "c", version: "1.0.0", summary: "s", variables: [] },
      },
    };

    it("customizes a built-in template and refreshes the templates tree", async () => {
      customizeTemplateMock.mockResolvedValue({});
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.customizeTemplate")?.(builtInItem);

      expect(customizeTemplateMock).toHaveBeenCalledWith("/workspace/repo", "seed");
      expect(deps.refreshTemplatesTree).toHaveBeenCalled();
    });

    it("reports an already-customized template as a warning, not an error", async () => {
      customizeTemplateMock.mockRejectedValue(new TemplateAlreadyExistsError("already exists"));
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.customizeTemplate")?.(builtInItem);

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalled();
      expect(vscodeMock.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it("does nothing for a project-level template", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.customizeTemplate")?.({
        template: { ...builtInItem.template, origin: "project" as const },
      });

      expect(customizeTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.deleteProjectTemplate", () => {
    const projectItem = {
      template: {
        origin: "project" as const,
        manifest: { id: "seed", title: "Seed", category: "c", version: "1.0.0", summary: "s", variables: [] },
      },
    };

    it("deletes a project template after confirmation and refreshes the templates tree", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue("Delete");
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.deleteProjectTemplate")?.(projectItem);

      expect(deleteProjectTemplateMock).toHaveBeenCalledWith("/workspace/repo", "seed");
      expect(deps.refreshTemplatesTree).toHaveBeenCalled();
    });

    it("does not delete when the confirmation is declined", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue(undefined);
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteProjectTemplate")?.(projectItem);

      expect(deleteProjectTemplateMock).not.toHaveBeenCalled();
    });

    it("does nothing for a built-in template", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteProjectTemplate")?.({
        template: { ...projectItem.template, origin: "built-in" as const },
      });

      expect(deleteProjectTemplateMock).not.toHaveBeenCalled();
    });

    it("reports an unknown template id as a warning, not an error", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValueOnce("Delete");
      deleteProjectTemplateMock.mockRejectedValue(new UnknownProjectTemplateError("Unknown project-level template: seed"));
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteProjectTemplate")?.(projectItem);

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledTimes(2);
      expect(vscodeMock.window.showErrorMessage).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.insertTemplateIntoChange", () => {
    const templateItem = {
      template: {
        origin: "built-in" as const,
        manifest: {
          id: "seed",
          title: "Seed",
          category: "c",
          version: "1.0.0",
          summary: "s",
          variables: [{ name: "packageName", prompt: "Package name?", default: "app" }],
        },
      },
    };

    it("prompts for variables, renders, and inserts into all three artifact files", async () => {
      listChangesMock.mockResolvedValue({
        changes: [{ name: "active-change", completedTasks: 0, totalTasks: 3, lastModified: "t", status: "draft" }],
        root: { path: "/workspace/repo", source: "nearest" },
      });
      vscodeMock.window.showQuickPick.mockResolvedValue({ label: "active-change", description: "0/3 — draft" });
      vscodeMock.window.showInputBox.mockResolvedValue("myapp");
      renderTemplateMock.mockReturnValue({ proposal: "P body", design: "D body", tasks: "T body" });

      const changeDir = path.join("/workspace/repo", "openspec", "changes", "active-change");
      vscodeMock._documentContents.set(path.join(changeDir, "proposal.md"), "");
      vscodeMock._documentContents.set(path.join(changeDir, "design.md"), "");
      vscodeMock._documentContents.set(path.join(changeDir, "tasks.md"), "## 1. Existing\n");

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.insertTemplateIntoChange")?.(templateItem);

      expect(vscodeMock.window.showInputBox).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Package name?", value: "app" }),
      );
      expect(renderTemplateMock).toHaveBeenCalledWith(templateItem.template, { packageName: "myapp" });
      expect(vscodeMock._documentContents.get(path.join(changeDir, "proposal.md"))).toBe("P body");
      expect(vscodeMock._documentContents.get(path.join(changeDir, "design.md"))).toBe("D body");
      expect(vscodeMock._documentContents.get(path.join(changeDir, "tasks.md"))).toBe("## 1. Existing\n\nT body");
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalled();
    });

    it("does nothing when the variable prompt is dismissed", async () => {
      listChangesMock.mockResolvedValue({
        changes: [{ name: "active-change", completedTasks: 0, totalTasks: 3, lastModified: "t", status: "draft" }],
        root: { path: "/workspace/repo", source: "nearest" },
      });
      vscodeMock.window.showQuickPick.mockResolvedValue({ label: "active-change", description: "0/3 — draft" });
      vscodeMock.window.showInputBox.mockResolvedValue(undefined);

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.insertTemplateIntoChange")?.(templateItem);

      expect(renderTemplateMock).not.toHaveBeenCalled();
    });

    it("prompts boolean-typed variables via a Yes/No QuickPick", async () => {
      const booleanItem = {
        template: {
          origin: "built-in" as const,
          manifest: {
            id: "seed-bool",
            title: "Seed Bool",
            category: "c",
            version: "1.0.0",
            summary: "s",
            variables: [{ name: "includeTests", prompt: "Include tests?", type: "boolean" as const }],
          },
        },
      };
      listChangesMock.mockResolvedValue({
        changes: [{ name: "active-change", completedTasks: 0, totalTasks: 3, lastModified: "t", status: "draft" }],
        root: { path: "/workspace/repo", source: "nearest" },
      });
      vscodeMock.window.showQuickPick
        .mockResolvedValueOnce({ label: "active-change", description: "0/3 — draft" })
        .mockResolvedValueOnce("Yes");
      renderTemplateMock.mockReturnValue({ proposal: "", design: "", tasks: "" });
      const changeDir = path.join("/workspace/repo", "openspec", "changes", "active-change");
      vscodeMock._documentContents.set(path.join(changeDir, "proposal.md"), "");
      vscodeMock._documentContents.set(path.join(changeDir, "design.md"), "");
      vscodeMock._documentContents.set(path.join(changeDir, "tasks.md"), "");

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.insertTemplateIntoChange")?.(booleanItem);

      expect(renderTemplateMock).toHaveBeenCalledWith(booleanItem.template, { includeTests: true });
    });
  });
});
