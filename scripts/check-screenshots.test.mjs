import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { capturedBy, checkScreenshots, readBaseline } from "./check-screenshots.mjs";

// The check has to fail on the picture nobody accounted for, and it has
// to keep failing on a listing that outlived its picture. Both are the
// same defect from opposite ends: a record of the repository that stops
// describing the repository. See every-screenshot-is-taken-by-a-spec.

const CAPTURE_SOURCE = [
    'import path from "node:path";',
    'const IMAGES_DIR = path.join(dir, "..", "..", "..", "docs", "images", "standalone");',
    'await page.screenshot({ path: path.join(IMAGES_DIR, "pipeline.png"), fullPage: true });',
].join("\n");

async function repoWith({ pictures = [], captures = {}, baseline } = {}) {
    const root = await mkdtemp(path.join(os.tmpdir(), "screenshot-check-"));
    for (const picture of pictures) {
        const file = path.join(root, picture);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, "");
    }
    for (const [name, source] of Object.entries(captures)) {
        const file = path.join(root, "packages", "server", "e2e", name);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, source);
    }
    if (baseline !== undefined) {
        await mkdir(path.join(root, "scripts"), { recursive: true });
        await writeFile(path.join(root, "scripts", "screenshot-baseline.json"), baseline);
    }
    return root;
}

test("capturedBy finds the pictures a capture writes, directory and name", () => {
    assert.deepEqual(capturedBy(CAPTURE_SOURCE), ["docs/images/standalone/pipeline.png"]);
});

test("capturedBy reports nothing for a source that names no images directory", () => {
    assert.deepEqual(capturedBy('await page.screenshot({ path: "somewhere/else.png" });'), []);
});

test("a picture a capture writes passes", async () => {
    const root = await repoWith({
        pictures: ["docs/images/standalone/pipeline.png"],
        captures: { "pipeline.spec.ts": CAPTURE_SOURCE },
    });
    try {
        const { problems } = await checkScreenshots(root);
        assert.deepEqual(problems, []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("a picture with neither a capture nor a listing fails, naming the picture", async () => {
    const root = await repoWith({ pictures: ["docs/images/standalone/by-hand.png"] });
    try {
        const { problems } = await checkScreenshots(root);
        assert.equal(problems.length, 1);
        assert.match(problems[0] ?? "", /docs\/images\/standalone\/by-hand\.png/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("a listed picture passes, and the listing says when it was taken", async () => {
    const root = await repoWith({
        pictures: ["docs/images/extension/specs-list.png"],
        baseline: JSON.stringify([
            { path: "docs/images/extension/specs-list.png", reason: "external-product", captured: "2026-09-12" },
        ]),
    });
    try {
        const { problems, listed } = await checkScreenshots(root);
        assert.deepEqual(problems, []);
        assert.equal(listed.get("docs/images/extension/specs-list.png")?.captured, "2026-09-12");
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("a listing with a reason outside the closed set fails", async () => {
    const root = await repoWith({
        pictures: ["docs/images/extension/specs-list.png"],
        baseline: JSON.stringify([
            { path: "docs/images/extension/specs-list.png", reason: "looks-nicer", captured: "2026-09-12" },
        ]),
    });
    try {
        const { problems } = await checkScreenshots(root);
        // Two: the reason is refused, and the picture it would have
        // covered is then unaccounted for. A rejected entry must not
        // still shelter its picture.
        assert.equal(problems.length, 2);
        assert.match(problems[0] ?? "", /looks-nicer/u);
        assert.match(problems[1] ?? "", /specs-list\.png/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("a listing without a date fails", () => {
    const { problems } = readBaseline(JSON.stringify([{ path: "docs/images/x.png", reason: "external-product" }]));
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /captured/u);
});

test("a listing whose picture is gone fails", async () => {
    const root = await repoWith({
        baseline: JSON.stringify([
            { path: "docs/images/extension/deleted.png", reason: "external-product", captured: "2026-08-22" },
        ]),
    });
    try {
        const { problems } = await checkScreenshots(root);
        assert.equal(problems.length, 1);
        assert.match(problems[0] ?? "", /deleted\.png/u);
        assert.match(problems[0] ?? "", /no such picture/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("a repository with no pictures at all passes", async () => {
    const root = await repoWith({});
    try {
        const { problems } = await checkScreenshots(root);
        assert.deepEqual(problems, []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("an empty baseline is legal, and still reports a picture nobody takes", () => {
  // The exception mechanism stays after the last picture leaves it.
  // Deleting it would make the next hand-taken picture legal by silence;
  // an empty list keeps adding one a visible edit that states a reason.
  const { entries, problems } = readBaseline("[]");
  assert.equal(problems.length, 0);
  assert.equal(entries.length, 0);
});

test("editor-native is no longer a reason a picture may be listed with", () => {
  // Retired by an-editor-picture-is-taken-too: Playwright drives
  // Electron, VS Code is Electron, and those nine are captured now. The
  // test exists so that restoring it is a deliberate act.
  const { problems } = readBaseline(
    JSON.stringify([{ path: "docs/images/x.png", reason: "editor-native", captured: "2026-09-12" }]),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /editor-native/);
});
