import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkChangeGraph, parseRelations } from "./check-change-graph.mjs";

async function repoWith(changes) {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-change-graph-"));
    for (const [relative, metadata] of Object.entries(changes)) {
        const dir = path.join(root, "openspec", "changes", relative);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, ".openspec.yaml"), metadata, "utf8");
    }
    return root;
}

const BASE = "schema: spec-driven\ncreated: 2026-09-06\n";

test("parseRelations reads all three documented shapes", () => {
    assert.deepEqual(parseRelations(`${BASE}follows: one\n`).follows, ["one"]);
    assert.deepEqual(parseRelations(`${BASE}follows: [one, two]\n`).follows, ["one", "two"]);
    assert.deepEqual(parseRelations(`${BASE}follows:\n  - one\n  - two\n`).follows, ["one", "two"]);
});

test("parseRelations keeps the two keys apart", () => {
    const parsed = parseRelations(`${BASE}follows:\n  - one\nsupersedes:\n  - two\n`);
    assert.deepEqual(parsed.follows, ["one"]);
    assert.deepEqual(parsed.supersedes, ["two"]);
});

test("parseRelations reports a key it cannot read rather than reading it as absent", () => {
    // An unreadable edge that parsed as "no edge" would be the worst
    // outcome: the check would pass while the relation went unverified.
    assert.equal(parseRelations(`${BASE}follows:\n`).errors.length, 1);
    assert.equal(parseRelations(`${BASE}follows: [one, two\n`).errors.length, 1);
    assert.equal(parseRelations(`${BASE}follows: not a valid id\n`).errors.length, 1);
});

test("an edge to an active change resolves", async () => {
    const root = await repoWith({
        "later": `${BASE}follows:\n  - earlier\n`,
        "earlier": BASE,
    });
    try {
        assert.deepEqual(await checkChangeGraph(root), []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("an edge to an archived change resolves, date prefix and all", async () => {
    // Most edges point at archived work, which is where their value is.
    // Archiving renames the directory; it must not break an edge.
    const root = await repoWith({
        "later": `${BASE}supersedes:\n  - earlier\n`,
        "archive/2026-09-02-earlier": BASE,
    });
    try {
        assert.deepEqual(await checkChangeGraph(root), []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("an edge to nothing fails, naming the change and the id", async () => {
    const root = await repoWith({ "later": `${BASE}follows:\n  - never-created\n` });
    try {
        const violations = await checkChangeGraph(root);
        assert.equal(violations.length, 1);
        assert.equal(violations[0]?.filePath, "openspec/changes/later/.openspec.yaml");
        assert.match(violations[0]?.reason ?? "", /never-created/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("a cycle fails and names the changes in it", async () => {
    const root = await repoWith({
        "a": `${BASE}follows:\n  - b\n`,
        "b": `${BASE}follows:\n  - a\n`,
    });
    try {
        const violations = await checkChangeGraph(root);
        assert.equal(violations.length, 1);
        assert.match(violations[0]?.reason ?? "", /cycle: a -> b -> a/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("a change with no relations passes", async () => {
    // The relation is optional. An absent edge is not a defect, and a
    // check that demanded one would push authors into inventing them.
    const root = await repoWith({ "solo": BASE, "archive/2026-09-01-old": BASE });
    try {
        assert.deepEqual(await checkChangeGraph(root), []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("two changes naming each other in different keys is still a cycle", async () => {
    // `git-fixture-test-cost` and `suite-survives-a-loaded-machine` name
    // each other in prose, because the former gained a back-reference
    // later. As prose that is fine; recorded as edges it would be a cycle,
    // and this is the test that says so.
    const root = await repoWith({
        "a": `${BASE}follows:\n  - b\n`,
        "b": `${BASE}supersedes:\n  - a\n`,
    });
    try {
        const violations = await checkChangeGraph(root);
        assert.equal(violations.length, 1);
        assert.match(violations[0]?.reason ?? "", /cycle/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
