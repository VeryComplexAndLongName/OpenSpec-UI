import type { ChangeGraph, ChangeGraphNode } from "@openspec-ui/core";
import { describe, expect, it } from "vitest";
import { renderChangeAncestry, renderChangeTree } from "./change-graph-render.js";

/** Fixtures rather than this repository's own graph: the archive grows
 * with every change, and a test that read it would start failing for
 * reasons that have nothing to do with the rendering. */
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

describe("renderChangeTree", () => {
  it("renders children under the change they follow", () => {
    const tree = renderChangeTree(graph({
      first: {},
      second: { follows: ["first"] },
      third: { follows: ["second"] },
    }));
    expect(tree).toBe(["first", "  └ second", "    └ third"].join("\n"));
  });

  it("marks archived changes", () => {
    expect(renderChangeTree(graph({ first: { archived: true }, second: { follows: ["first"] } })))
      .toMatch(/first \(archived\)/u);
  });

  it("shows a change with two parents under each", () => {
    // The relation is a DAG and this is a rendering of it. Assigning one
    // parent arbitrarily would drop the edge that explains half of why
    // the change exists.
    const tree = renderChangeTree(graph({ one: {}, two: {}, both: { follows: ["one", "two"] } }));
    expect(tree.split("\n").filter((line) => line.includes("both"))).toHaveLength(2);
  });

  it("annotates what a change supersedes without threading it as a parent", () => {
    const tree = renderChangeTree(graph({ old: {}, next: { follows: ["old"], supersedes: ["old"] } }));
    expect(tree).toMatch(/next {2}\[supersedes old\]/u);
    expect(tree.split("\n").filter((line) => line.includes("next"))).toHaveLength(1);
  });

  it("marks a change waiting on one that has not landed", () => {
    // The first question the graph is asked: what can be started now.
    const tree = renderChangeTree(graph({ base: {}, waiting: { blockedBy: ["base"] } }));
    expect(tree).toMatch(/waiting \(waiting on base\)/u);
  });

  it("stops marking it once the blocker is archived", () => {
    const tree = renderChangeTree(graph({ base: { archived: true }, waiting: { blockedBy: ["base"] } }));
    expect(tree).not.toMatch(/waiting on/u);
  });

  it("omits changes that state no relation unless asked for all", () => {
    const spec = { linked: {}, child: { follows: ["linked"] }, isolated: {} };
    expect(renderChangeTree(graph(spec))).not.toMatch(/isolated/u);
    expect(renderChangeTree(graph(spec), { all: true })).toMatch(/isolated/u);
  });

  it("says so when nothing states a relation", () => {
    expect(renderChangeTree(graph({ alone: {} }))).toBe("No change states a relation yet.");
  });

  it("renders a cycle instead of hiding it", () => {
    // With a cycle nothing is a root, so nothing printed and the output
    // claimed no relation existed — the whole subgraph vanished. A test
    // found that; this is the test.
    const tree = renderChangeTree(graph({ a: { follows: ["b"] }, b: { follows: ["a"] } }));
    expect(tree).toMatch(/Not reachable from any root/u);
    expect(tree).toMatch(/cycle back to/u);
  });
});

describe("renderChangeAncestry", () => {
  it("walks from a change back to its reasons", () => {
    const ancestry = renderChangeAncestry(graph({
      root: { archived: true },
      middle: { follows: ["root"] },
      leaf: { follows: ["middle"] },
    }), "leaf");
    expect(ancestry).toBe(["leaf", "  ↑ middle", "    ↑ root (archived)"].join("\n"));
  });

  it("says when a change follows nothing", () => {
    expect(renderChangeAncestry(graph({ alone: {} }), "alone")).toMatch(/follows nothing/u);
  });

  it("reports an unknown id rather than printing an empty tree", () => {
    expect(renderChangeAncestry(graph({ alone: {} }), "nope")).toMatch(/No change with id "nope"/u);
  });
});
