import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const listChangesMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  listChanges: (...args: unknown[]) => listChangesMock(...args),
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
    getRunners: () => new Map([["claude-cli", { run: async function* () {} }]]),
    getConfig: () => ({ localServerEnabled: false, defaultAgentId: "claude-cli" }),
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
        "openspec-ui.plan",
        "openspec-ui.implement",
        "openspec-ui.review",
        "openspec-ui.status",
        "openspec-ui.cancel",
        "openspec-ui.openAiPanel",
        "openspec-ui.reviewDiff",
      ]),
    );
  });

  it("openspec-ui.plan: picks a change, runs it through the resolved runner, and reveals the AI panel", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "shared-ui", completedTasks: 1, totalTasks: 17, lastModified: "t", status: "in-progress" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    vscodeMock.window.showQuickPick.mockResolvedValue({ label: "shared-ui", description: "1/17 — in-progress" });

    const deps = makeDeps();
    const runSpy = vi.spyOn(deps.runController, "run");
    const context = makeContext();
    registerCommands(context as unknown as import("vscode").ExtensionContext, deps);

    const handler = vscodeMock._registeredCommands.get("openspec-ui.plan");
    await handler?.();

    expect(deps.revealAiPanel).toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledTimes(1);
    const [, command] = runSpy.mock.calls[0]!;
    expect(command).toMatchObject({
      kind: "plan",
      cwd: "/workspace/repo",
      agentId: "claude-cli",
      context: { changeDir: expect.stringContaining("shared-ui") },
    });
  });

  it("shows an error and does not run anything when no workspace is open", async () => {
    const deps = makeDeps({ getWorkspaceRoot: () => undefined });
    const runSpy = vi.spyOn(deps.runController, "run");
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.plan")?.();

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

    await vscodeMock._registeredCommands.get("openspec-ui.plan")?.();

    expect(runSpy).not.toHaveBeenCalled();
  });

  it("openspec-ui.cancel: shows an info message when nothing is running", async () => {
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    vscodeMock._registeredCommands.get("openspec-ui.cancel")?.();

    expect(vscodeMock.window.showInformationMessage).toHaveBeenCalled();
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
});
