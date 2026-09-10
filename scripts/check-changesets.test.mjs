import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkChangesets, readChangesetFrontmatter } from "./check-changesets.mjs";

// A lint that reads one spelling of what it checks passes the other
// spellings unread. All three forms below are valid YAML and all three
// are accepted by `changeset version`, so a green run has to mean the
// lint read all three. See a-check-that-passes-checked-something.

const FRONTMATTER = [
    "---",
    '"@openspec-ui/core": minor',
    "'@openspec-ui/server': patch",
    "openspec-ui-vscode: patch",
    "---",
    "",
    "A changeset body.",
].join("\n");

test("readChangesetFrontmatter reads bare, single-quoted and double-quoted names", () => {
    const { names, problems } = readChangesetFrontmatter(".changeset/x.md", FRONTMATTER);
    assert.deepEqual(names, ["@openspec-ui/core", "@openspec-ui/server", "openspec-ui-vscode"]);
    assert.deepEqual(problems, []);
});

test("readChangesetFrontmatter refuses a frontmatter line it cannot read, naming file and line", () => {
    const source = ['---', '"@openspec-ui/core": patch', "just some prose", "---", ""].join("\n");
    const { names, problems } = readChangesetFrontmatter(".changeset/x.md", source);
    assert.deepEqual(names, ["@openspec-ui/core"]);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /^\.changeset\/x\.md:4:/u);
    assert.match(problems[0] ?? "", /just some prose/u);
});

test("readChangesetFrontmatter refuses a name with no bump beside it", () => {
    const { problems } = readChangesetFrontmatter(".changeset/x.md", '---\n"@openspec-ui/core":\n---\n');
    assert.equal(problems.length, 1);
});

test("readChangesetFrontmatter ignores blank lines and comments", () => {
    const source = ["---", "# a note", "", "openspec-ui-vscode: patch", "---", ""].join("\n");
    const { names, problems } = readChangesetFrontmatter(".changeset/x.md", source);
    assert.deepEqual(names, ["openspec-ui-vscode"]);
    assert.deepEqual(problems, []);
});

test("readChangesetFrontmatter reads nothing from a file with no frontmatter", () => {
    const { names, problems } = readChangesetFrontmatter(".changeset/x.md", "Just a note.\n");
    assert.deepEqual(names, []);
    assert.deepEqual(problems, []);
});

/** A workspace with two packages and whatever changesets a test states. */
async function workspaceWith(changesets) {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-changeset-lint-"));
    await writeFile(
        path.join(root, "package.json"),
        JSON.stringify({ name: "root", private: true, workspaces: ["packages/*"] }),
        "utf8",
    );
    for (const name of ["@openspec-ui/core", "openspec-ui-vscode"]) {
        const dir = path.join(root, "packages", name.split("/").pop() ?? name);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, "package.json"), JSON.stringify({ name, version: "0.0.0" }), "utf8");
    }
    await mkdir(path.join(root, ".changeset"), { recursive: true });
    for (const [file, source] of Object.entries(changesets)) {
        await writeFile(path.join(root, ".changeset", file), source, "utf8");
    }
    return root;
}

test("checkChangesets accepts every name form when each names a real package", async () => {
    const root = await workspaceWith({
        "good.md": '---\n"@openspec-ui/core": minor\n\'@openspec-ui/core\': patch\nopenspec-ui-vscode: patch\n---\n\nBody.\n',
    });
    try {
        const { problems } = await checkChangesets(root);
        assert.deepEqual(problems, []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("checkChangesets fails on a misspelled bare name", async () => {
    // The whole point: this is the form the old lint could not see, and
    // `changeset version` fails on it after the merge.
    const root = await workspaceWith({ "typo.md": "---\nopenspec-ui-vscodee: patch\n---\n\nBody.\n" });
    try {
        const { problems } = await checkChangesets(root);
        assert.equal(problems.length, 1);
        assert.match(problems[0] ?? "", /typo\.md/u);
        assert.match(problems[0] ?? "", /openspec-ui-vscodee/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("checkChangesets fails on a misspelled single-quoted name", async () => {
    const root = await workspaceWith({ "typo.md": "---\n'@openspec-ui/kore': patch\n---\n\nBody.\n" });
    try {
        const { problems } = await checkChangesets(root);
        assert.equal(problems.length, 1);
        assert.match(problems[0] ?? "", /@openspec-ui\/kore/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("checkChangesets ignores README.md and non-markdown entries", async () => {
    const root = await workspaceWith({
        "README.md": "---\nnot-a-package: patch\n---\n",
        "config.json": '{"changelog": false}',
    });
    try {
        const { problems } = await checkChangesets(root);
        assert.deepEqual(problems, []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
