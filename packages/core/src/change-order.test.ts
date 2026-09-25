import { describe, expect, it } from "vitest";
import { compareChangeNames, compareChanges, describeChangeOrder, laterOf, orderFactsOf, rankChanges, type ChangeOrderFacts } from "./change-order.js";
import { layoutChanges, layoutChangesByStage } from "./change-layout.js";
import type { ChangeReadiness } from "./change-readiness-facts.js";

// the-board-sorts-its-cards. Pure functions over names and three facts.

describe("compareChangeNames", () => {
  it("reads the digits in a name as a number, so a numbered change stands in its place", () => {
    const names = ["change-10-exports", "CHANGE-2-login", "change-1-setup"];

    expect([...names].sort(compareChangeNames)).toEqual(["change-1-setup", "CHANGE-2-login", "change-10-exports"]);
  });

  it("is total: names equal but for case still have an order", () => {
    expect(compareChangeNames("Alpha", "alpha")).not.toBe(0);
    expect(compareChangeNames("alpha", "alpha")).toBe(0);
  });
});

describe("compareChanges", () => {
  const facts = new Map<string, ChangeOrderFacts>([
    ["half", { done: 3, total: 6, lastActivity: "2026-09-20T10:00:00.000Z" }],
    ["nearly", { done: 9, total: 10, lastActivity: "2026-09-22T10:00:00.000Z" }],
    ["fresh", { done: 0, total: 4, lastActivity: "2026-09-24T08:00:00.000Z" }],
    ["unread", {}],
  ]);
  const names = ["unread", "half", "fresh", "nearly"];

  it("by name, ignores every fact", () => {
    expect([...names].sort(compareChanges("name", facts))).toEqual(["fresh", "half", "nearly", "unread"]);
  });

  it("by progress, puts the change furthest along first, and one without a task list last", () => {
    expect([...names].sort(compareChanges("progress", facts))).toEqual(["nearly", "half", "fresh", "unread"]);
  });

  it("by recent, puts the change worked on last first, and one never worked on last", () => {
    expect([...names].sort(compareChanges("recent", facts))).toEqual(["fresh", "nearly", "half", "unread"]);
  });

  it("breaks a tie by name", () => {
    const tied = new Map<string, ChangeOrderFacts>([["b", { done: 1, total: 2 }], ["a", { done: 2, total: 4 }]]);

    expect(["b", "a"].sort(compareChanges("progress", tied))).toEqual(["a", "b"]);
  });

  it("orders a day and a moment of that day as ISO text does", () => {
    expect(laterOf("2026-09-24", "2026-09-24T08:00:00.000Z")).toBe("2026-09-24T08:00:00.000Z");
    expect(laterOf(undefined, "2026-09-24")).toBe("2026-09-24");
    expect(laterOf(undefined, undefined)).toBeUndefined();
  });

  it("takes progress from the card, and the later of a run's end and the task list's last change", () => {
    expect(orderFactsOf({
      card: { progress: { done: 2, total: 5, forPerson: 0, delegated: 0 }, lastRun: { runId: "r", outcome: "completed", endedAt: "2026-09-20T10:00:00.000Z" } },
      surveyed: { tasksDone: 0, tasksTotal: 5, tasksModifiedAt: "2026-09-23T10:00:00.000Z" },
    })).toEqual({ done: 2, total: 5, lastActivity: "2026-09-23T10:00:00.000Z" });
  });

  it("takes progress from the survey where there is no card, but not from a task list it could not read", () => {
    expect(orderFactsOf({ surveyed: { tasksDone: 1, tasksTotal: 3 } })).toEqual({ done: 1, total: 3 });
    expect(orderFactsOf({ surveyed: { tasksDone: 0, tasksTotal: 0, tasksUnreadable: "EACCES" } })).toEqual({});
    expect(orderFactsOf({ archivedOn: "2026-09-21" })).toEqual({ lastActivity: "2026-09-21" });
  });

  it("names each order for the control that picks it", () => {
    expect(["name", "progress", "recent"].map((order) => describeChangeOrder(order as "name"))).toEqual(["Name", "Progress", "Recently changed"]);
  });
});

function ready(changeName: string, blockers: string[] = []): ChangeReadiness {
  return { changeName, run: { kind: "ready" }, blockers, capabilities: [], canJoin: [], blockedFrom: [] } as unknown as ChangeReadiness;
}

describe("a layout stacks a column by rank", () => {
  const report = { changes: [ready("change-10"), ready("change-2"), ready("change-1")] };

  it("in name order, read as numbers, where no rank is given", () => {
    expect(layoutChanges(report).columns[0]).toEqual(["change-1", "change-2", "change-10"]);
  });

  it("in the rank's order where one is given, the cards placed top to bottom", () => {
    const rank = rankChanges(["change-1", "change-2", "change-10"], "recent", new Map([
      ["change-10", { lastActivity: "2026-09-24" }],
      ["change-1", { lastActivity: "2026-09-01" }],
    ]));
    const layout = layoutChanges(report, { rank });

    expect(layout.columns[0]).toEqual(["change-10", "change-1", "change-2"]);
    const ys = new Map(layout.nodes.map((node) => [node.change.changeName, node.y]));
    expect((ys.get("change-10") as number) < (ys.get("change-1") as number)).toBe(true);
    expect((ys.get("change-1") as number) < (ys.get("change-2") as number)).toBe(true);
  });

  it("on the board too, within each stage's column", () => {
    const rank = rankChanges(["change-1", "change-2", "change-10"], "progress", new Map([
      ["change-2", { done: 1, total: 1 }],
      ["change-10", { done: 1, total: 2 }],
    ]));
    const layout = layoutChangesByStage(report, { stages: new Map(), rank });

    expect(layout.columns.find((column) => column.length > 0)).toEqual(["change-2", "change-10", "change-1"]);
  });
});
