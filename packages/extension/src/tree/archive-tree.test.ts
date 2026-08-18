import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const discoverOpenSpecWorkspaceMock = vi.fn();
const readTaskChecklistMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
  readTaskChecklist: (...args: unknown[]) => readTaskChecklistMock(...args),
}));

const { ArchiveTreeProvider } = await import("./archive-tree.js");

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  readTaskChecklistMock.mockResolvedValue([]);
});

describe("ArchiveTreeProvider", () => {
  it("lists archived changes as collapsible nodes", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      archiveExists: true,
      archivedChanges: [
        { name: "old-change-1", path: "/archive/old-change-1", state: "archived", artifacts: [] },
        { name: "old-change-2", path: "/archive/old-change-2", state: "archived", artifacts: [] },
      ],
    });

    const provider = new ArchiveTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.label)).toEqual(["old-change-1", "old-change-2"]);
    expect(items[0]?.description).toBe("archived");
    expect(items.map((i) => i.id)).toEqual(["change:archived:old-change-1", "change:archived:old-change-2"]);
  });

  it("shows archived tasks as read-only (openspec-ui.archivedTask) children", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      archiveExists: true,
      archivedChanges: [{ name: "old-change-1", path: "/archive/old-change-1", state: "archived", artifacts: [] }],
    });
    readTaskChecklistMock.mockResolvedValue([{ lineNumber: 0, text: "Only task", done: false }]);

    const provider = new ArchiveTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const children = await provider.getChildren(roots[0]);

    expect(readTaskChecklistMock).toHaveBeenCalledWith("/workspace/repo", "old-change-1", true);
    expect(children.map((item) => item.label)).toEqual(["Only task"]);
    expect(children[0]?.contextValue).toBe("openspec-ui.archivedTask");
    expect(children[0]?.id).toBe("task:archived:old-change-1:0");
    expect(children[0]?.id).not.toBe(roots[0]?.id);
  });

  it("explains when the archive directory does not exist", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({ archiveExists: false, archivedChanges: [] });

    const provider = new ArchiveTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe("No archived changes");
    expect(items[0]?.description).toContain("first archive");
  });
});
