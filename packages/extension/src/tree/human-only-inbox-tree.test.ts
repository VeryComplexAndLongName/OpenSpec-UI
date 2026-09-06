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

const { HumanOnlyInboxItemTreeItem, HumanOnlyInboxTreeProvider } = await import("./human-only-inbox-tree.js");

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  discoverOpenSpecWorkspaceMock.mockResolvedValue({
    changes: [
      { name: "change-a", path: "/repo/openspec/changes/change-a" },
      { name: "change-b", path: "/repo/openspec/changes/change-b" },
    ],
  });
});

describe("HumanOnlyInboxTreeProvider", () => {
  it("lists open human-only items across active changes, each naming its change", async () => {
    readTaskChecklistMock.mockImplementation(async (_root: string, changeName: string) => {
      if (changeName === "change-a") {
        return [
          { lineNumber: 2, text: "1.1 Ordinary task", done: false },
          { lineNumber: 3, text: "1.2 **Human-only**: confirm by hand", done: false, humanOnly: true },
        ];
      }
      return [{ lineNumber: 5, text: "2.1 **Human-only**: another one", done: false, humanOnly: true }];
    });

    const provider = new HumanOnlyInboxTreeProvider("/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(2);
    expect(items.every((item) => item instanceof HumanOnlyInboxItemTreeItem)).toBe(true);
    expect(items.map((item) => item.description)).toEqual(["change-a", "change-b"]);
    expect(items.map((item) => item.label)).toEqual([
      "1.2 **Human-only**: confirm by hand",
      "2.1 **Human-only**: another one",
    ]);
  });

  it("excludes a human-only item already marked done", async () => {
    readTaskChecklistMock.mockImplementation(async (_root: string, changeName: string) => {
      if (changeName === "change-a") {
        return [{ lineNumber: 2, text: "1.1 **Human-only**: done already", done: true, humanOnly: true }];
      }
      return [];
    });

    const provider = new HumanOnlyInboxTreeProvider("/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(1);
    expect(items[0]?.contextValue).toBe("openspec-ui.empty");
  });

  it("says nothing is waiting rather than showing an empty list", async () => {
    readTaskChecklistMock.mockResolvedValue([]);

    const provider = new HumanOnlyInboxTreeProvider("/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(1);
    expect(items[0]?.contextValue).toBe("openspec-ui.empty");
  });

  it("selecting an item reveals the task it belongs to, with no mutating control bound to it", async () => {
    readTaskChecklistMock.mockImplementation(async (_root: string, changeName: string) => {
      if (changeName === "change-a") {
        return [{ lineNumber: 2, text: "1.1 **Human-only**: confirm by hand", done: false, humanOnly: true }];
      }
      return [];
    });

    const provider = new HumanOnlyInboxTreeProvider("/repo");
    const [item] = await provider.getChildren();

    expect(item?.command?.command).toBe("openspec-ui.revealTask");
    expect(item?.command?.arguments).toEqual([item]);
    // A distinct contextValue from the Changes tree's own task rows means
    // no `deleteTask`-style menu entry (bound to `openspec-ui.activeTask`)
    // can match here — see package.json's `view/item/context` menus.
    expect(item?.contextValue).toBe("openspec-ui.humanOnlyInboxItem");
  });

  it("returns no children for an item, since rows never nest", async () => {
    readTaskChecklistMock.mockImplementation(async (_root: string, changeName: string) => {
      if (changeName === "change-a") {
        return [{ lineNumber: 2, text: "1.1 **Human-only**: x", done: false, humanOnly: true }];
      }
      return [];
    });
    const provider = new HumanOnlyInboxTreeProvider("/repo");
    const [item] = await provider.getChildren();
    expect(await provider.getChildren(item)).toEqual([]);
  });
});
