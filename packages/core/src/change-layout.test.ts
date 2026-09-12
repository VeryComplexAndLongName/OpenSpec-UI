import { describe, expect, it } from "vitest";
import {
  COLUMN_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROW_GAP,
  layoutChanges,
  type ChangeLayoutEdge,
} from "./change-layout.js";
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

function relations(edges: ChangeLayoutEdge[]): string[] {
  return edges.map((edge) => `${edge.from} -> ${edge.to}`);
}

describe("layoutChanges", () => {
  it("puts a chain of blockers in successive columns", () => {
    const layout = layoutChanges(report(
      change("first"),
      change("second", { blockers: ["first"], run: { state: "blocked", blockedBy: ["first"] } }),
      change("third", { blockers: ["second"], run: { state: "blocked", blockedBy: ["second"] } }),
    ));

    expect(layout.columns).toEqual([["first"], ["second"], ["third"]]);
    expect(relations(layout.edges)).toEqual(["first -> second", "second -> third"]);
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

    expect(layout.nodes).toEqual([
      { change: running, column: 0, row: 0, x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT },
    ]);
  });

  it("gives every node a place, so nothing has to be measured", () => {
    const layout = layoutChanges(report(
      change("root"),
      change("alpha", { blockers: ["root"] }),
      change("beta", { blockers: ["root"] }),
    ));

    const at = (name: string) => layout.nodes.find((node) => node.change.changeName === name);
    expect(at("root")).toMatchObject({ x: 0, y: 0 });
    expect(at("alpha")).toMatchObject({ x: NODE_WIDTH + COLUMN_GAP, y: 0 });
    expect(at("beta")).toMatchObject({ x: NODE_WIDTH + COLUMN_GAP, y: NODE_HEIGHT + ROW_GAP });
  });

  it("runs an edge between neighbours out of one card and into the next", () => {
    const layout = layoutChanges(report(change("first"), change("second", { blockers: ["first"] })));

    const [edge] = layout.edges;
    const middle = NODE_HEIGHT / 2;
    // Same row, so the turn in the gap collapses and the line is
    // straight — the corners that are not turns are not reported.
    expect(edge?.points).toEqual([
      { x: NODE_WIDTH, y: middle },
      { x: NODE_WIDTH + COLUMN_GAP, y: middle },
    ]);
  });

  it("routes an edge that skips a column clear of what is between", () => {
    const layout = layoutChanges(report(
      change("root"),
      change("middle", { blockers: ["root"] }),
      // Deepest blocker is `middle` at depth 1, so this sits at depth 2
      // and root's edge to it spans two columns — straight through where
      // `middle` is drawn.
      change("last", { blockers: ["root", "middle"] }),
    ));

    const detour = layout.edges.find((edge) => edge.from === "root" && edge.to === "last");
    const rowBottom = NODE_HEIGHT;
    expect(detour).toBeDefined();
    // It leaves the row band entirely rather than crossing the card in
    // the column between.
    expect(detour?.points.some((point) => point.y > rowBottom)).toBe(true);
    // And the picture is tall enough to contain the lane it travels in.
    expect(layout.height).toBeGreaterThanOrEqual(Math.max(...(detour?.points.map((p) => p.y) ?? [0])));
  });

  it("gives two detours lanes of their own", () => {
    const layout = layoutChanges(report(
      change("root"),
      change("other-root"),
      change("middle", { blockers: ["root"] }),
      change("last", { blockers: ["root", "middle"] }),
      change("also-last", { blockers: ["other-root", "middle"] }),
    ));

    const lanes = layout.edges
      .filter((edge) => edge.points.length > 4)
      .map((edge) => edge.points[2]?.y);
    // Two sharing one lane would draw as a single line that appears to
    // fork.
    expect(new Set(lanes).size).toBe(lanes.length);
    expect(lanes.length).toBe(2);
  });

  it("covers every node with the extent it reports", () => {
    const layout = layoutChanges(report(
      change("root"),
      change("alpha", { blockers: ["root"] }),
      change("beta", { blockers: ["root"] }),
    ));

    for (const node of layout.nodes) {
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
    }
  });

  it("draws no edge to something that has no place", () => {
    const layout = layoutChanges(report(
      change("egg", { blockers: ["chicken"] }),
      change("chicken", { blockers: ["egg"] }),
      change("breakfast", { blockers: ["egg"] }),
    ));

    // Every change here is in or behind the cycle, so there is nowhere
    // for a line to start or end. It is reported in words instead.
    expect(layout.edges).toEqual([]);
  });

  it("has nothing to lay out for an empty report", () => {
    expect(layoutChanges(report())).toEqual({
      columns: [],
      nodes: [],
      edges: [],
      cycles: [],
      unplaced: [],
      width: 0,
      height: 0,
    });
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
