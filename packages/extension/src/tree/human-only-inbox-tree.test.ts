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

const {
  HumanOnlyInboxItemTreeItem,
  HumanOnlyInboxTreeProvider,
  RUNNABLE_INBOX_ITEM_CONTEXT,
  WAITING_INBOX_ITEM_CONTEXT,
} = await import("./human-only-inbox-tree.js");

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

describe("HumanOnlyInboxTreeProvider — which rows can be run", () => {
  it("gives a row naming a registered agent the contextValue the run command binds to", async () => {
    // The control exists only where it can do something. A row waiting
    // on a person carries none, which is the distinction the marking
    // exists for — see a-delegated-item-runs-its-agent.
    collectHumanOnlyInboxMock.mockResolvedValue(inbox([
      { changeName: "change-a", lineNumber: 3, text: "1.2 **Human-only**: judge it" },
      {
        changeName: "change-b",
        lineNumber: 5,
        text: "2.1 **Delegated to copilot-cli**: quote the audit line",
        waitingOn: { kind: "agent", agent: "copilot-cli", known: true },
      },
      {
        changeName: "change-c",
        lineNumber: 1,
        text: "1.1 **Delegated to copilto-cli**: a typo",
        waitingOn: { kind: "agent", agent: "copilto-cli", known: false },
      },
    ]));

    const items = await new HumanOnlyInboxTreeProvider("/repo").getChildren();

    expect(items.map((item) => item.contextValue)).toEqual([
      WAITING_INBOX_ITEM_CONTEXT,
      RUNNABLE_INBOX_ITEM_CONTEXT,
      // An id nothing recognises is not runnable either: the run would
      // refuse it, and a control that always refuses is worse than none.
      WAITING_INBOX_ITEM_CONTEXT,
    ]);
  });

  it("shows what a run reported on the row it was started from", async () => {
    // A notification that has been dismissed is an outcome nobody can
    // go back and read, and the row is where the item lives.
    const row = {
      changeName: "change-b",
      lineNumber: 5,
      text: "2.1 **Delegated to copilot-cli**: quote the audit line",
      waitingOn: { kind: "agent" as const, agent: "copilot-cli", known: true },
    };
    collectHumanOnlyInboxMock.mockResolvedValue(inbox([row]));

    const provider = new HumanOnlyInboxTreeProvider("/repo");
    const [before] = await provider.getChildren();
    expect(before?.description).toBe("change-b — waiting on copilot-cli");

    provider.reportOutcome(before as InstanceType<typeof HumanOnlyInboxItemTreeItem>, "refused: ticked with nothing written");
    const [after] = await provider.getChildren();

    expect(after?.description)
      .toBe("change-b — waiting on copilot-cli — refused: ticked with nothing written");
  });
});
