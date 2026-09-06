import assert from "node:assert/strict";
import test from "node:test";
import { renderAncestry, renderTree } from "./change-graph.mjs";

/** Fixtures rather than this repository's own graph: the archive grows
 * with every change, and a test that read it would start failing for
 * reasons that have nothing to do with the rendering. */
function graph(spec) {
    const nodes = new Map();
    for (const [id, value] of Object.entries(spec)) {
        nodes.set(id, {
            id,
            archived: value.archived ?? false,
            follows: value.follows ?? [],
            supersedes: value.supersedes ?? [],
            errors: [],
            metadataPath: `openspec/changes/${id}/.openspec.yaml`,
        });
    }
    return nodes;
}

test("renders children under the change they follow", () => {
    const tree = renderTree(graph({
        first: {},
        second: { follows: ["first"] },
        third: { follows: ["second"] },
    }));
    assert.equal(tree, ["first", "  └ second", "    └ third"].join("\n"));
});

test("marks archived changes", () => {
    const tree = renderTree(graph({ first: { archived: true }, second: { follows: ["first"] } }));
    assert.match(tree, /first \(archived\)/u);
});

test("a change with two parents appears under each", () => {
    // The relation is a DAG and this is a rendering of it. A rendering
    // that assigned one parent arbitrarily would drop the edge that
    // explains half of why the change exists.
    const tree = renderTree(graph({
        one: {},
        two: {},
        both: { follows: ["one", "two"] },
    }));
    assert.equal(tree.split("\n").filter((line) => line.includes("both")).length, 2);
});

test("annotates what a change supersedes without threading it as a parent", () => {
    // `supersedes` says this change corrected a decision, not that it
    // grew out of one. Threading it into the tree would claim an order
    // the repository never stated.
    const tree = renderTree(graph({
        old: {},
        next: { follows: ["old"], supersedes: ["old"] },
    }));
    assert.match(tree, /next {2}\[supersedes old\]/u);
    assert.equal(tree.split("\n").filter((line) => line.includes("next")).length, 1);
});

test("omits changes that state no relation unless asked for all", () => {
    const spec = { linked: {}, child: { follows: ["linked"] }, isolated: {} };
    assert.doesNotMatch(renderTree(graph(spec)), /isolated/u);
    assert.match(renderTree(graph(spec), { all: true }), /isolated/u);
});

test("says so when nothing states a relation", () => {
    assert.equal(renderTree(graph({ alone: {} })), "No change states a relation yet.");
});

test("a cycle renders without recursing forever", () => {
    const tree = renderTree(graph({ a: { follows: ["b"] }, b: { follows: ["a"] } }));
    assert.match(tree, /cycle back to/u);
});

test("ancestry walks from a change back to its reasons", () => {
    const ancestry = renderAncestry(graph({
        root: { archived: true },
        middle: { follows: ["root"] },
        leaf: { follows: ["middle"] },
    }), "leaf");
    assert.equal(ancestry, ["leaf", "  ↑ middle", "    ↑ root (archived)"].join("\n"));
});

test("ancestry says when a change follows nothing", () => {
    assert.match(renderAncestry(graph({ alone: {} }), "alone"), /follows nothing/u);
});

test("ancestry reports an unknown id rather than printing an empty tree", () => {
    assert.match(renderAncestry(graph({ alone: {} }), "nope"), /No change with id "nope"/u);
});
