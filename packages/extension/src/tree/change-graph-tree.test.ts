import type { ChangeGraph, ChangeGraphNode } from "@openspec-ui/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const readChangeGraphMock = vi.fn();
vi.mock("@openspec-ui/core", async () => {
  const actual = await vi.importActual<typeof import("@openspec-ui/core")>("@openspec-ui/core");
  return { ...actual, readChangeGraph: (...args: unknown[]) => readChangeGraphMock(...args) };
});

const { ChangeGraphTreeProvider, ChangeGraphNoticeTreeItem, ancestryOf, findGraphRows } = await import("./change-graph-tree.js");

afterEach(() => {
  vi.clearAllMocks();
});

/** Fixtures rather than this repository's own graph: the archive grows
 * with every change, and a test reading it would fail for reasons that
 * have nothing to do with the rendering. */
function graph(spec: Record<string, Partial<ChangeGraphNode>>): ChangeGraph {
  const nodes: ChangeGraph = new Map();
  for (const [id, value] of Object.entries(spec)) {
    nodes.set(id, {
      id,
      archived: value.archived ?? false,
      follows: value.follows ?? [],
      supersedes: value.supersedes ?? [],
      blockedBy: value.blockedBy ?? [],
      errors: [],
      metadataPath: `openspec/changes/${id}/.openspec.yaml`,
    });
  }
  return nodes;
}

function provider(spec: Record<string, Partial<ChangeGraphNode>>) {
  readChangeGraphMock.mockResolvedValue(graph(spec));
  return new ChangeGraphTreeProvider("/repo");
}

describe("ChangeGraphTreeProvider", () => {
  it("roots the tree at changes that follow nothing", async () => {
    const roots = await provider({ first: {}, second: { follows: ["first"] } }).getChildren();
    expect(roots).toHaveLength(1);
    expect(roots[0]?.label).toBe("first");
  });

  it("nests a change under the one it follows", async () => {
    const tree = provider({ first: {}, second: { follows: ["first"] } });
    const [root] = await tree.getChildren();
    const children = await tree.getChildren(root);
    expect(children.map((child) => child.label)).toEqual(["second"]);
  });

  it("shows a change with two parents under each", async () => {
    // The relation is a DAG. Assigning one parent arbitrarily would drop
    // the edge that explains half of why the change exists — so the rows
    // are distinguished by the path they were reached through, not by id
    // alone.
    const tree = provider({ one: {}, two: {}, both: { follows: ["one", "two"] } });
    const roots = await tree.getChildren();
    const under = await Promise.all(roots.map((root) => tree.getChildren(root)));
    expect(under.flat().map((item) => item.label)).toEqual(["both", "both"]);
    expect(new Set(under.flat().map((item) => item.id)).size).toBe(2);
  });

  it("marks a change waiting on one that has not landed", async () => {
    const [root] = await provider({ base: {}, waiting: { blockedBy: ["base"] } }).getChildren();
    const waiting = (await provider({ base: {}, waiting: { blockedBy: ["base"] } }).getChildren())
      .find((item) => item.label === "waiting");
    expect(root).toBeDefined();
    expect(waiting?.description).toContain("waiting on base");
  });

  it("stops marking it once the blocker is archived", async () => {
    const items = await provider({
      base: { archived: true },
      waiting: { blockedBy: ["base"] },
    }).getChildren();
    expect(items.find((item) => item.label === "waiting")?.description ?? "").not.toContain("waiting on");
  });

  it("marks archived changes and annotates what one supersedes", async () => {
    const items = await provider({
      old: { archived: true },
      next: { follows: ["old"], supersedes: ["old"] },
    }).getChildren();
    expect(items[0]?.description).toContain("archived");
    const tree = provider({ old: { archived: true }, next: { follows: ["old"], supersedes: ["old"] } });
    const [root] = await tree.getChildren();
    const [child] = await tree.getChildren(root);
    expect(child?.description).toContain("supersedes old");
  });

  it("omits changes that state no relation", async () => {
    const items = await provider({ linked: {}, child: { follows: ["linked"] }, isolated: {} }).getChildren();
    expect(items.map((item) => item.label)).toEqual(["linked"]);
  });

  it("says so when nothing states a relation", async () => {
    const [item] = await provider({ alone: {} }).getChildren();
    expect(item?.label).toBe("No change states a relation");
  });

  it("shows a cycle instead of letting the subgraph vanish", async () => {
    // Everything in a cycle follows something, so none of it is a root
    // and none of it would render. The terminal renderer had exactly this
    // defect and a test caught it; this is that test here.
    const items = await provider({ a: { follows: ["b"] }, b: { follows: ["a"] } }).getChildren();
    expect(items.some((item) => item instanceof ChangeGraphNoticeTreeItem)).toBe(true);
    expect(items.map((item) => item.label)).toContain("a");
  });

  it("closes a cycle once, marked, and expands no further", async () => {
    // The repeat is shown rather than hidden — the terminal renderer
    // prints "(cycle back to a)" for the same reason — and then stops, so
    // expanding never recurses.
    // In a pure cycle nothing is a root, so the top level is the notice
    // followed by the stranded changes — start from the change, not from
    // the first row.
    const tree = provider({ a: { follows: ["b"] }, b: { follows: ["a"] } });
    const first = (await tree.getChildren()).find((item) => item.label === "a");
    const [second] = await tree.getChildren(first);
    const [repeat] = await tree.getChildren(second);

    expect(second?.label).toBe("b");
    expect(repeat?.label).toBe("a");
    expect(repeat?.description).toContain("cycle");
    expect(await tree.getChildren(repeat)).toEqual([]);
  });

  it("offers no mutating action", async () => {
    // Every action on a change lives where it appears exactly once. A
    // change with three parents shows three rows here; three Archive
    // buttons for one change is what this separation avoids.
    const items = await provider({ first: {}, second: { follows: ["first"] } }).getChildren();
    expect(items[0]?.contextValue).toBe("openspec-ui.graphActiveChange");
    expect(items[0]?.command).toBeUndefined();
  });

  describe("getParent", () => {
    it("resolves a root row to undefined", async () => {
      const tree = provider({ first: {}, second: { follows: ["first"] } });
      const [root] = await tree.getChildren();
      expect(await tree.getParent(root!)).toBeUndefined();
    });

    it("resolves a nested row to the row above it on its path", async () => {
      const tree = provider({ first: {}, second: { follows: ["first"] } });
      const [root] = await tree.getChildren();
      const [child] = await tree.getChildren(root);
      const parent = await tree.getParent(child!);
      expect(parent?.label).toBe("first");
      expect(parent?.id).toBe(root?.id);
    });

    it("resolves each of a change's several rows to its own distinct parent", async () => {
      const tree = provider({ one: {}, two: {}, both: { follows: ["one", "two"] } });
      const roots = await tree.getChildren();
      const under = await Promise.all(roots.map((root) => tree.getChildren(root)));
      const bothUnderOne = under[0]?.[0];
      const bothUnderTwo = under[1]?.[0];
      const parentOfFirst = await tree.getParent(bothUnderOne!);
      const parentOfSecond = await tree.getParent(bothUnderTwo!);
      expect(parentOfFirst?.id).toBe(roots[0]?.id);
      expect(parentOfSecond?.id).toBe(roots[1]?.id);
      expect(parentOfFirst?.id).not.toBe(parentOfSecond?.id);
    });
  });
});

describe("findGraphRows", () => {
  it("finds the sole row for a change with one row", async () => {
    readChangeGraphMock.mockResolvedValue(graph({ first: {}, second: { follows: ["first"] } }));
    const rows = await findGraphRows("/repo", "second");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("second");
  });

  it("finds every row for a change with several parents", async () => {
    readChangeGraphMock.mockResolvedValue(graph({ one: {}, two: {}, both: { follows: ["one", "two"] } }));
    const rows = await findGraphRows("/repo", "both");
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
  });

  it("finds no rows for a change that states no relation", async () => {
    readChangeGraphMock.mockResolvedValue(graph({ alone: {} }));
    const rows = await findGraphRows("/repo", "alone");
    expect(rows).toEqual([]);
  });

  it("finds every row in the stranded subgraph a cycle produces", async () => {
    // Neither change is a root in a pure cycle, so each renders once as its
    // own stranded top-level row and once as the child of the other's —
    // the same duplication `getChildren` itself renders (see "closes a
    // cycle once, marked, and expands no further" above).
    readChangeGraphMock.mockResolvedValue(graph({ a: { follows: ["b"] }, b: { follows: ["a"] } }));
    const rows = await findGraphRows("/repo", "b");
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.label === "b")).toBe(true);
  });

  it("finds no rows for an id absent from the graph entirely", async () => {
    readChangeGraphMock.mockResolvedValue(graph({ first: {} }));
    const rows = await findGraphRows("/repo", "nope");
    expect(rows).toEqual([]);
  });
});

describe("ancestryOf", () => {
  it("lists what a change grew out of, nearest reason first", () => {
    const nodes = graph({ root: {}, middle: { follows: ["root"] }, leaf: { follows: ["middle"] } });
    expect(ancestryOf(nodes, "leaf").map((node) => node.id)).toEqual(["middle", "root"]);
  });

  it("returns nothing for a change that follows nothing", () => {
    expect(ancestryOf(graph({ alone: {} }), "alone")).toEqual([]);
  });

  it("returns nothing for an unknown id", () => {
    expect(ancestryOf(graph({ alone: {} }), "nope")).toEqual([]);
  });

  it("does not loop on a cycle", () => {
    const nodes = graph({ a: { follows: ["b"] }, b: { follows: ["a"] } });
    expect(ancestryOf(nodes, "a").map((node) => node.id)).toEqual(["b"]);
  });
});
