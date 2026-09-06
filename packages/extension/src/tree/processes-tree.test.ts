import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const readTaskChecklistMock = vi.fn();
vi.mock("@openspec-ui/core", async () => {
  const actual = await vi.importActual<typeof import("@openspec-ui/core")>("@openspec-ui/core");
  return {
    ...actual,
    readTaskChecklist: (...args: unknown[]) => readTaskChecklistMock(...args),
  };
});

const { ProcessTreeItem, ProcessesTreeProvider } = await import("./processes-tree.js");

afterEach(() => {
  vi.clearAllMocks();
});

function process(
  operation: string,
  state: "queued" | "running" | "suspended" | "completed" | "failed" | "cancelled" | "interrupted",
  extra: Partial<{ changeName: string; agentId: string; waitingFor: string; progress: string }> = {},
) {
  return {
    id: `${operation}-${state}`,
    operation,
    state,
    mutating: operation !== "validate" && operation !== "status",
    createdAt: "2026-08-08T00:00:00.000Z",
    ...extra,
  } as import("@openspec-ui/core").WorkbenchProcess;
}

describe("ProcessTreeItem", () => {
  it("offers finish only for active implementation sessions", () => {
    expect(new ProcessTreeItem(process("implement", "running"), undefined).contextValue).toBe("openspec-ui.implementationProcess");
    expect(new ProcessTreeItem(process("archive", "running"), undefined).contextValue).toBe("openspec-ui.finishedProcess");
  });

  it("offers rollback for terminal mutating sessions with checkpoints", () => {
    expect(new ProcessTreeItem(process("implement", "completed"), undefined).contextValue).toBe("openspec-ui.rollbackableProcess");
    expect(new ProcessTreeItem(process("implement", "failed"), undefined).contextValue).toBe("openspec-ui.rollbackableProcess");
    expect(new ProcessTreeItem(process("validate", "completed"), undefined).contextValue).toBe("openspec-ui.finishedProcess");
    expect(new ProcessTreeItem(process("implement", "interrupted"), undefined).contextValue).toBe("openspec-ui.rollbackableProcess");
    expect(new ProcessTreeItem(process("archive", "failed"), undefined).contextValue).toBe("openspec-ui.rollbackableProcess");
  });

  it("does not show live progress beside a terminal state", () => {
    // The row this removes read `usage-from-acp · completed · Running`:
    // `state` says the run is over and `progress` says it is working.
    const item = new ProcessTreeItem(process("archive", "completed", { changeName: "demo", progress: "Running" }), undefined);
    expect(item.description).toBe("demo · completed");
  });

  it("shows progress while the run is still going", () => {
    const item = new ProcessTreeItem(process("implement", "running", { changeName: "demo", progress: "Working in VS Code Agent mode" }), undefined);
    expect(item.description).toBe("demo · running · Working in VS Code Agent mode");
  });

  it("keeps progress reachable in the tooltip of a finished run", () => {
    // A reclaimed workspace lease is recorded in `progress` and nowhere
    // else, so hiding it from the row must not put it out of reach.
    const reclaimed = "Reclaimed the workspace lease from VS Code extension on HOST (pid 1), which stopped renewing it 2194s ago.";
    const item = new ProcessTreeItem(process("implement", "completed", { changeName: "demo", progress: reclaimed }), undefined);
    expect(item.description).toBe("demo · completed");
    expect(item.tooltip).toBe(reclaimed);
  });

  it("includes the agentId and percent-complete in the description when known", () => {
    const item = new ProcessTreeItem(process("implement", "running", { changeName: "demo", agentId: "claude-cli" }), "75%");
    expect(item.description).toBe("demo · claude-cli · 75% · running");
  });

  it("omits agentId and percent from the description when unknown", () => {
    const item = new ProcessTreeItem(process("archive", "running", { changeName: "demo" }), undefined);
    expect(item.description).toBe("demo · running");
  });

  it("renders identically to today when the process carries no usage (task 6.3)", () => {
    const item = new ProcessTreeItem(process("implement", "completed", { changeName: "demo" }), undefined);
    expect(item.description).toBe("demo · completed");
    expect(item.description).not.toContain("$");
  });

  it("shows the recorded cost in the description when the process carries usage (task 6.1)", () => {
    const withCost = {
      ...process("implement", "completed", { changeName: "demo" }),
      usage: { costUsd: 0.26 },
    } as import("@openspec-ui/core").WorkbenchProcess;
    const item = new ProcessTreeItem(withCost, undefined);
    expect(item.description).toBe("demo · completed · $0.26");
  });

  it("renders a suspended process as waiting, with its wait reason, distinctly from running (harness-suspendable-stage task 6.1)", () => {
    const running = new ProcessTreeItem(process("implement", "running", { changeName: "demo" }), undefined);
    const suspended = new ProcessTreeItem(
      process("implement", "suspended", { changeName: "demo", waitingFor: "a CI run to finish" }),
      undefined,
    );

    expect(suspended.description).toBe("demo · suspended · a CI run to finish");
    expect(suspended.tooltip).toBe("a CI run to finish");
    expect(suspended.iconPath).not.toEqual(running.iconPath);
    expect((suspended.iconPath as { id: string }).id).not.toBe("sync~spin");
  });
});

describe("ProcessesTreeProvider", () => {
  it("computes percent-complete per change from readTaskChecklist, not the process's own progress field", async () => {
    readTaskChecklistMock.mockResolvedValue([
      { lineNumber: 0, text: "a", done: true },
      { lineNumber: 1, text: "b", done: true },
      { lineNumber: 2, text: "c", done: false },
      { lineNumber: 3, text: "d", done: false },
    ]);
    const scheduler = { list: () => [process("implement", "running", { changeName: "demo" })], onDidChange: () => () => undefined };

    const provider = new ProcessesTreeProvider(scheduler as never, "/workspace/repo");
    const [item] = await provider.getChildren();

    expect(readTaskChecklistMock).toHaveBeenCalledWith("/workspace/repo", "demo", false);
    expect(item?.description).toContain("50%");
  });

  it("falls back to the archived checklist when the change has no active tasks.md", async () => {
    readTaskChecklistMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { lineNumber: 0, text: "a", done: true },
        { lineNumber: 1, text: "b", done: false },
      ]);
    const scheduler = { list: () => [process("archive", "completed", { changeName: "old-change" })], onDidChange: () => () => undefined };

    const provider = new ProcessesTreeProvider(scheduler as never, "/workspace/repo");
    const [item] = await provider.getChildren();

    expect(readTaskChecklistMock).toHaveBeenNthCalledWith(1, "/workspace/repo", "old-change", false);
    expect(readTaskChecklistMock).toHaveBeenNthCalledWith(2, "/workspace/repo", "old-change", true);
    expect(item?.description).toContain("50%");
  });

  it("omits percent for a process with no changeName", async () => {
    const scheduler = { list: () => [process("status", "completed")], onDidChange: () => () => undefined };

    const provider = new ProcessesTreeProvider(scheduler as never, "/workspace/repo");
    const [item] = await provider.getChildren();

    expect(readTaskChecklistMock).not.toHaveBeenCalled();
    expect(item?.description).not.toMatch(/%/);
  });
});
