import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const discoverOpenSpecWorkspaceMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
}));

const { ArchiveTreeProvider } = await import("./archive-tree.js");

afterEach(() => {
  vi.clearAllMocks();
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
