import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const listChangesMock = vi.fn();
const listSpecsMock = vi.fn();
const showChangeMock = vi.fn();
const validateChangeMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  listChanges: (...args: unknown[]) => listChangesMock(...args),
  listSpecs: (...args: unknown[]) => listSpecsMock(...args),
  showChange: (...args: unknown[]) => showChangeMock(...args),
  validateChange: (...args: unknown[]) => validateChangeMock(...args),
}));

const openDiffAgainstHeadMock = vi.fn();
vi.mock("./native/diff.js", () => ({ openDiffAgainstHead: (...args: unknown[]) => openDiffAgainstHeadMock(...args) }));

const { registerCommands } = await import("./commands.js");
const { RunController } = await import("./run-controller.js");

afterEach(() => {
  vi.clearAllMocks();
});

function makeContext() {
  return { subscriptions: [] as Array<{ dispose(): void }> };
}

function makeDeps(overrides: Partial<Parameters<typeof registerCommands>[1]> = {}) {
  const runController = new RunController();
  const outputChannel = { appendLine: vi.fn(), clear: vi.fn(), show: vi.fn() };
  return {
    getWorkspaceRoot: () => "/workspace/repo",
    runController,
    outputChannel: outputChannel as unknown as import("vscode").OutputChannel,
    revealAiPanel: vi.fn(),
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
        "openspec-ui.openspecView",
        "openspec-ui.showChangeDetails",
        "openspec-ui.validateChangeStrict",
        "openspec-ui.listSpecsSummary",
        "openspec-ui.openAiPanel",
        "openspec-ui.reviewDiff",
      ]),
    );
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
});
