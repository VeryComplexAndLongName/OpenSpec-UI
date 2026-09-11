import { describe, expect, it } from "vitest";
import { layoutChanges } from "./change-layout.js";
import type { ChangeReadiness, ChangeReadinessReport } from "./change-readiness.js";

function change(changeName: string, overrides: Partial<ChangeReadiness> = {}): ChangeReadiness {
  return {
    changeName,
    blockers: [],
    run: { state: "ready" },
    capabilities: [],
    canJoin: [],
    blockedFrom: [],
    ...overrides,
  };
}

function report(...changes: ChangeReadiness[]): ChangeReadinessReport {
  return { changes };
}

describe("layoutChanges", () => {
  it("puts a chain of blockers in successive columns", () => {
    const layout = layoutChanges(report(
      change("first"),
      change("second", { blockers: ["first"], run: { state: "blocked", blockedBy: ["first"] } }),
      change("third", { blockers: ["second"], run: { state: "blocked", blockedBy: ["second"] } }),
    ));

    expect(layout.columns).toEqual([["first"], ["second"], ["third"]]);
    expect(layout.edges).toEqual([
      { from: "first", to: "second" },
      { from: "second", to: "third" },
    ]);
  });

  it("puts changes with no relation side by side", () => {
    const layout = layoutChanges(report(change("alpha"), change("beta"), change("gamma")));

    // Sequential work is a graph one lane wide; this is the other shape,
    // and it is the same drawing.
    expect(layout.columns).toEqual([["alpha", "beta", "gamma"]]);
    expect(layout.edges).toEqual([]);
  });

  it("places a change one past the deepest thing it waits on", () => {
    const layout = layoutChanges(report(
      change("root"),
      change("middle", { blockers: ["root"] }),
      // Blocked by one at depth 0 and one at depth 1: it belongs after
      // both, not after the first one it happens to name.
      change("last", { blockers: ["root", "middle"] }),
    ));

    expect(layout.columns).toEqual([["root"], ["middle"], ["last"]]);
  });

  it("orders a column by name, and not by run state", () => {
    const first = layoutChanges(report(
      change("zebra"),
      change("apple"),
      change("mango", { run: { state: "running", worktreePath: "/w", holder: holder() } }),
    ));
    const second = layoutChanges(report(
      change("zebra", { run: { state: "running", worktreePath: "/w", holder: holder() } }),
      change("apple"),
      change("mango"),
    ));

    // A node that moved because a run started would read as the plan
    // having changed. Only the repository moves nodes.
    expect(first.columns).toEqual([["apple", "mango", "zebra"]]);
    expect(second.columns).toEqual(first.columns);
  });

  it("draws no relation to a blocker that is not a change here", () => {
    // A blocker that has archived is satisfied and is no longer a node,
    // so there is nothing to point at.
    const layout = layoutChanges(report(change("alone", { blockers: ["long-since-archived"] })));

    expect(layout.columns).toEqual([["alone"]]);
    expect(layout.edges).toEqual([]);
  });

  it("names a cycle rather than placing it", () => {
    const layout = layoutChanges(report(
      change("egg", { blockers: ["chicken"] }),
      change("chicken", { blockers: ["egg"] }),
      change("bystander"),
    ));

    expect(layout.cycles).toEqual([["chicken", "egg"]]);
    expect(layout.unplaced).toEqual(["chicken", "egg"]);
    expect(layout.columns).toEqual([["bystander"]]);
  });

  it("treats a change that blocks itself as a cycle of one", () => {
    const layout = layoutChanges(report(change("ouroboros", { blockers: ["ouroboros"] })));

    expect(layout.cycles).toEqual([["ouroboros"]]);
    expect(layout.columns).toEqual([]);
  });

  it("cannot place what waits on a cycle", () => {
    const layout = layoutChanges(report(
      change("egg", { blockers: ["chicken"] }),
      change("chicken", { blockers: ["egg"] }),
      change("breakfast", { blockers: ["egg"] }),
    ));

    // There is no column one past nowhere.
    expect(layout.cycles).toEqual([["chicken", "egg"]]);
    expect(layout.unplaced).toEqual(["breakfast", "chicken", "egg"]);
    expect(layout.columns).toEqual([]);
  });

  it("never turns a collision into a relation", () => {
    const layout = layoutChanges(report(
      change("alpha", {
        blockedFrom: [{ changeName: "beta", collisions: [{ kind: "shared-capability", capability: "ci-cli" }] }],
      }),
      change("beta", {
        blockedFrom: [{ changeName: "alpha", collisions: [{ kind: "shared-capability", capability: "ci-cli" }] }],
      }),
    ));

    // Two changes that would meet in one spec file have no precedence
    // between them; a line would assert one (ADR 0025).
    expect(layout.edges).toEqual([]);
    expect(layout.columns).toEqual([["alpha", "beta"]]);
  });

  it("carries each change through to its node", () => {
    const running = change("live", { run: { state: "running", worktreePath: "/w", holder: holder("ada@example.com") } });
    const layout = layoutChanges(report(running));

    expect(layout.nodes).toEqual([{ change: running, column: 0, row: 0 }]);
  });

  it("has nothing to lay out for an empty report", () => {
    expect(layoutChanges(report())).toEqual({ columns: [], nodes: [], edges: [], cycles: [], unplaced: [] });
  });
});

function holder(author?: string) {
  return {
    hostKind: "cli" as const,
    hostname: "a-machine",
    pid: 777,
    heartbeatAgeMs: 3_000,
    ...(author !== undefined ? { author } : {}),
  };
}
