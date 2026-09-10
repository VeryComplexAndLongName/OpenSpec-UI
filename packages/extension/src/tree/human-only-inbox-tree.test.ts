import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

// Which items are waiting is `collectHumanOnlyInbox`'s question now, and
// is tested where it lives — see core's `human-only-inbox.test.ts`. What
// these assert is what this tree does with the answer.
const collectHumanOnlyInboxMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  collectHumanOnlyInbox: (...args: unknown[]) => collectHumanOnlyInboxMock(...args),
  describeWaitingOn: (waitingOn: { kind: string; agent?: string; known?: boolean }) =>
    (waitingOn.kind === "person"
      ? "a person"
      : waitingOn.known ? waitingOn.agent : `"${waitingOn.agent}", which is not a registered agent`),
}));

const { HumanOnlyInboxItemTreeItem, HumanOnlyInboxTreeProvider } = await import("./human-only-inbox-tree.js");

afterEach(() => {
  vi.clearAllMocks();
});

type Waiting = { kind: "person" } | { kind: "agent"; agent: string; known: boolean };

function inbox(items: Array<{ changeName: string; lineNumber: number; text: string; waitingOn?: Waiting }>) {
  return {
    items: items.map((item) => ({
      waitingOn: { kind: "person" } as Waiting,
      ...item,
      changeDir: `/repo/openspec/changes/${item.changeName}`,
    })),
    changesRead: 2,
  };
}

beforeEach(() => {
  collectHumanOnlyInboxMock.mockResolvedValue(inbox([]));
});

describe("HumanOnlyInboxTreeProvider", () => {
  it("lists open human-only items across active changes, each naming its change", async () => {
    collectHumanOnlyInboxMock.mockResolvedValue(inbox([
      { changeName: "change-a", lineNumber: 3, text: "1.2 **Human-only**: confirm by hand" },
      { changeName: "change-b", lineNumber: 5, text: "2.1 **Human-only**: another one" },
    ]));

    const provider = new HumanOnlyInboxTreeProvider("/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(2);
    expect(items.every((item) => item instanceof HumanOnlyInboxItemTreeItem)).toBe(true);
    expect(items.map((item) => item.description))
      .toEqual(["change-a — waiting on a person", "change-b — waiting on a person"]);
    expect(items.map((item) => item.label)).toEqual([
      "1.2 **Human-only**: confirm by hand",
      "2.1 **Human-only**: another one",
    ]);
  });

  it("shows the empty note when nothing is waiting", async () => {

    const provider = new HumanOnlyInboxTreeProvider("/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(1);
    expect(items[0]?.contextValue).toBe("openspec-ui.empty");
  });

  it("says nothing is waiting rather than showing an empty list", async () => {
    const provider = new HumanOnlyInboxTreeProvider("/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(1);
    expect(items[0]?.contextValue).toBe("openspec-ui.empty");
  });

  it("selecting an item reveals the task it belongs to, with no mutating control bound to it", async () => {
    collectHumanOnlyInboxMock.mockResolvedValue(inbox([
      { changeName: "change-a", lineNumber: 2, text: "1.1 **Human-only**: confirm by hand" },
    ]));

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
    collectHumanOnlyInboxMock.mockResolvedValue(inbox([
      { changeName: "change-a", lineNumber: 2, text: "1.1 **Human-only**: x" },
    ]));
    const provider = new HumanOnlyInboxTreeProvider("/repo");
    const [item] = await provider.getChildren();
    expect(await provider.getChildren(item)).toEqual([]);
  });
});

describe("HumanOnlyInboxTreeProvider — who each row waits on", () => {
  it("names the agent for a delegated item and a person for a human-only one", async () => {
    // Before a-live-check-names-who-performs-it both read identically,
    // and an item assigned to an agent that had not run looked like a
    // question nobody had answered.
    collectHumanOnlyInboxMock.mockResolvedValue(inbox([
      { changeName: "change-a", lineNumber: 3, text: "1.2 **Human-only**: judge it" },
      {
        changeName: "change-b",
        lineNumber: 5,
        text: "2.1 **Delegated to copilot-cli**: quote the audit line",
        waitingOn: { kind: "agent", agent: "copilot-cli", known: true },
      },
    ]));

    const items = await new HumanOnlyInboxTreeProvider("/repo").getChildren();

    expect(items.map((item) => item.description))
      .toEqual(["change-a — waiting on a person", "change-b — waiting on copilot-cli"]);
  });

  it("says so when the named agent is not one the registry carries", async () => {
    collectHumanOnlyInboxMock.mockResolvedValue(inbox([{
      changeName: "change-a",
      lineNumber: 1,
      text: "1.1 **Delegated to copilto-cli**: a typo",
      waitingOn: { kind: "agent", agent: "copilto-cli", known: false },
    }]));

    const items = await new HumanOnlyInboxTreeProvider("/repo").getChildren();

    expect(items[0]?.description).toBe('change-a — waiting on "copilto-cli", which is not a registered agent');
  });
});
