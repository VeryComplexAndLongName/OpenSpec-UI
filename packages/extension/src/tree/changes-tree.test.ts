import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const listChangesMock = vi.fn();
const readChangeStateMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  listChanges: (...args: unknown[]) => listChangesMock(...args),
  readChangeState: (...args: unknown[]) => readChangeStateMock(...args),
}));

const { ChangesTreeProvider } = await import("./changes-tree.js");

afterEach(() => {
  vi.clearAllMocks();
});

describe("ChangesTreeProvider", () => {
  it("lists non-archived changes with their derived state as description", async () => {
    listChangesMock.mockResolvedValue({
      changes: [
        { name: "execution-core", completedTasks: 20, totalTasks: 20, lastModified: "t", status: "implemented" },
        { name: "shared-ui", completedTasks: 4, totalTasks: 17, lastModified: "t", status: "in-progress" },
      ],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    readChangeStateMock.mockImplementation((changeDir: string) =>
      Promise.resolve(changeDir.includes("execution-core") ? "implemented" : "in-progress"),
    );

    const provider = new ChangesTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(2);
    expect(items[0]?.changeName).toBe("execution-core");
    expect(items[0]?.description).toBe("implemented");
    expect(items[1]?.description).toBe("in-progress");
  });

  it("excludes changes whose derived state is archived (belongs to the Archive tree)", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "old-change", completedTasks: 5, totalTasks: 5, lastModified: "t", status: "archived" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    readChangeStateMock.mockResolvedValue("archived");

    const provider = new ChangesTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(0);
  });

  it("wires the tree item's click command to open proposal.md", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "shared-ui", completedTasks: 1, totalTasks: 1, lastModified: "t", status: "draft" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    readChangeStateMock.mockResolvedValue("draft");

    const provider = new ChangesTreeProvider("/workspace/repo");
    const [item] = await provider.getChildren();

    expect(item?.command?.command).toBe("vscode.open");
    expect((item?.command?.arguments?.[0] as { fsPath: string }).fsPath).toContain("proposal.md");
  });

  it("refresh() fires onDidChangeTreeData", () => {
    const provider = new ChangesTreeProvider("/workspace/repo");
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);
    provider.refresh();
    expect(listener).toHaveBeenCalled();
  });
});
