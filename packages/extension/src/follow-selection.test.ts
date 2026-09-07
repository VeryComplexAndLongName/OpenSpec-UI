import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const readConfigMock = vi.fn();
vi.mock("./config.js", () => ({ readConfig: () => readConfigMock() }));

const findGraphRowsMock = vi.fn();
vi.mock("./tree/change-graph-tree.js", () => ({ findGraphRows: (...args: unknown[]) => findGraphRowsMock(...args) }));

const { registerFollowSelection } = await import("./follow-selection.js");

afterEach(() => {
  vi.clearAllMocks();
});

const CHANGE_ROW = {
  changeName: "leaf",
  changeDir: "/workspace/repo/openspec/changes/leaf",
  archived: false,
  contextValue: "openspec-ui.activeChange",
};

function makeSelectionView() {
  let listeners: Array<(e: { selection: readonly unknown[] }) => void> = [];
  return {
    onDidChangeSelection: vi.fn((listener: (e: { selection: readonly unknown[] }) => void) => {
      listeners.push(listener);
      return { dispose: () => { listeners = listeners.filter((l) => l !== listener); } };
    }),
    fire(selection: readonly unknown[]): void {
      for (const listener of listeners) listener({ selection });
    },
  };
}

describe("registerFollowSelection", () => {
  it("with the setting off, a selection change reveals nothing", async () => {
    readConfigMock.mockReturnValue({ followSelectionInChangeGraph: false });
    const changesView = makeSelectionView();
    const archiveView = makeSelectionView();
    const changeGraphView = { reveal: vi.fn() };

    registerFollowSelection({
      getWorkspaceRoot: () => "/workspace/repo",
      changesView,
      archiveView,
      changeGraphView,
    });
    changesView.fire([CHANGE_ROW]);
    await Promise.resolve();

    expect(changeGraphView.reveal).not.toHaveBeenCalled();
    expect(findGraphRowsMock).not.toHaveBeenCalled();
  });

  it("with the setting on, reveals every row for the selected change without stealing focus", async () => {
    readConfigMock.mockReturnValue({ followSelectionInChangeGraph: true });
    findGraphRowsMock.mockResolvedValue([{ label: "leaf-row-1" }, { label: "leaf-row-2" }]);
    const changesView = makeSelectionView();
    const archiveView = makeSelectionView();
    const changeGraphView = { reveal: vi.fn() };

    registerFollowSelection({
      getWorkspaceRoot: () => "/workspace/repo",
      changesView,
      archiveView,
      changeGraphView,
    });
    changesView.fire([CHANGE_ROW]);
    await Promise.resolve();
    await Promise.resolve();

    expect(findGraphRowsMock).toHaveBeenCalledWith("/workspace/repo", "leaf");
    expect(changeGraphView.reveal).toHaveBeenNthCalledWith(
      1,
      { label: "leaf-row-1" },
      { select: true, focus: false, expand: true },
    );
    expect(changeGraphView.reveal).toHaveBeenNthCalledWith(
      2,
      { label: "leaf-row-2" },
      { select: false, focus: false, expand: true },
    );
  });

  it("with the setting on and no row for the change, does nothing quietly", async () => {
    readConfigMock.mockReturnValue({ followSelectionInChangeGraph: true });
    findGraphRowsMock.mockResolvedValue([]);
    const changesView = makeSelectionView();
    const archiveView = makeSelectionView();
    const changeGraphView = { reveal: vi.fn() };

    registerFollowSelection({
      getWorkspaceRoot: () => "/workspace/repo",
      changesView,
      archiveView,
      changeGraphView,
    });
    changesView.fire([CHANGE_ROW]);
    await Promise.resolve();
    await Promise.resolve();

    expect(changeGraphView.reveal).not.toHaveBeenCalled();
  });

  it("also follows the Archive view's selection", async () => {
    readConfigMock.mockReturnValue({ followSelectionInChangeGraph: true });
    findGraphRowsMock.mockResolvedValue([{ label: "archived-row" }]);
    const changesView = makeSelectionView();
    const archiveView = makeSelectionView();
    const changeGraphView = { reveal: vi.fn() };

    registerFollowSelection({
      getWorkspaceRoot: () => "/workspace/repo",
      changesView,
      archiveView,
      changeGraphView,
    });
    archiveView.fire([{ ...CHANGE_ROW, archived: true, contextValue: "openspec-ui.archivedChange" }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(changeGraphView.reveal).toHaveBeenCalledWith(
      { label: "archived-row" },
      { select: true, focus: false, expand: true },
    );
  });

  it("unsubscribes when the setting is turned off, without requiring a reload", async () => {
    readConfigMock.mockReturnValue({ followSelectionInChangeGraph: true });
    findGraphRowsMock.mockResolvedValue([{ label: "leaf-row" }]);
    const changesView = makeSelectionView();
    const archiveView = makeSelectionView();
    const changeGraphView = { reveal: vi.fn() };
    let configListener: ((e: { affectsConfiguration: (key: string) => boolean }) => void) | undefined;
    vscodeMock.workspace.onDidChangeConfiguration.mockImplementationOnce((listener: typeof configListener) => {
      configListener = listener;
      return { dispose: vi.fn() };
    });

    registerFollowSelection({
      getWorkspaceRoot: () => "/workspace/repo",
      changesView,
      archiveView,
      changeGraphView,
    });

    readConfigMock.mockReturnValue({ followSelectionInChangeGraph: false });
    configListener?.({ affectsConfiguration: (key: string) => key === "openspec-ui.followSelectionInChangeGraph" });

    changesView.fire([CHANGE_ROW]);
    await Promise.resolve();
    await Promise.resolve();

    expect(changeGraphView.reveal).not.toHaveBeenCalled();
  });

  it("subscribes when the setting is turned on, without requiring a reload", async () => {
    readConfigMock.mockReturnValue({ followSelectionInChangeGraph: false });
    findGraphRowsMock.mockResolvedValue([{ label: "leaf-row" }]);
    const changesView = makeSelectionView();
    const archiveView = makeSelectionView();
    const changeGraphView = { reveal: vi.fn() };
    let configListener: ((e: { affectsConfiguration: (key: string) => boolean }) => void) | undefined;
    vscodeMock.workspace.onDidChangeConfiguration.mockImplementationOnce((listener: typeof configListener) => {
      configListener = listener;
      return { dispose: vi.fn() };
    });

    registerFollowSelection({
      getWorkspaceRoot: () => "/workspace/repo",
      changesView,
      archiveView,
      changeGraphView,
    });

    readConfigMock.mockReturnValue({ followSelectionInChangeGraph: true });
    configListener?.({ affectsConfiguration: (key: string) => key === "openspec-ui.followSelectionInChangeGraph" });

    changesView.fire([CHANGE_ROW]);
    await Promise.resolve();
    await Promise.resolve();

    expect(changeGraphView.reveal).toHaveBeenCalledWith(
      { label: "leaf-row" },
      { select: true, focus: false, expand: true },
    );
  });
});
