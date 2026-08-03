import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const readChangeStateMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  readChangeState: (...args: unknown[]) => readChangeStateMock(...args),
}));

const readdirMock = vi.fn();
vi.mock("node:fs/promises", () => ({ readdir: (...args: unknown[]) => readdirMock(...args) }));

const { ArchiveTreeProvider } = await import("./archive-tree.js");

afterEach(() => {
  vi.clearAllMocks();
});

function direntDir(name: string) {
  return { name, isDirectory: () => true };
}

describe("ArchiveTreeProvider", () => {
  it("lists directories under openspec/changes/archive with their derived state", async () => {
    readdirMock.mockResolvedValue([direntDir("old-change-1"), direntDir("old-change-2")]);
    readChangeStateMock.mockResolvedValue("archived");

    const provider = new ArchiveTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.changeName)).toEqual(["old-change-1", "old-change-2"]);
    expect(items[0]?.description).toBe("archived");
  });

  it("returns an empty list when the archive directory does not exist", async () => {
    readdirMock.mockRejectedValue(new Error("ENOENT"));

    const provider = new ArchiveTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items).toEqual([]);
  });

  it("skips non-directory entries", async () => {
    readdirMock.mockResolvedValue([{ name: "README.md", isDirectory: () => false }, direntDir("real-change")]);
    readChangeStateMock.mockResolvedValue("archived");

    const provider = new ArchiveTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(1);
    expect(items[0]?.changeName).toBe("real-change");
  });
});
