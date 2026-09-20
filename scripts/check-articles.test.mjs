import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkAll, checkArticleLinks, imageLinksIn, isRemote } from "./check-articles.mjs";

// A lint that passes whatever it is given has checked nothing, so each
// guarantee is broken once here and the failure is asserted by its words.
// See a-check-that-passes-checked-something.

const present = async () => true;
const absent = async () => false;

test("finds a markdown image and an img tag", () => {
  const text = [
    "![A cover](2026-09-20-a-piece-cover.png)",
    '<img src="../images/standalone/pipeline.png" alt="The Pipeline">',
    "[not a picture](https://example.com)",
  ].join("\n");

  assert.deepEqual(imageLinksIn(text), ["2026-09-20-a-piece-cover.png", "../images/standalone/pipeline.png"]);
});

test("leaves a remote picture alone: this check cannot look at it", async () => {
  assert.equal(isRemote("https://example.com/cover.png"), true);
  assert.equal(isRemote("//example.com/cover.png"), true);
  assert.equal(isRemote("cover.png"), false);

  assert.deepEqual(
    await checkArticleLinks("a-piece.md", "![A cover](https://example.com/cover.png)", absent),
    [],
  );
});

test("passes a cover beside the article and a picture a capture took", async () => {
  const text = [
    "![A cover](a-piece-cover.png)",
    "![The Pipeline](../images/standalone/pipeline.png)",
  ].join("\n");

  assert.deepEqual(await checkArticleLinks("a-piece.md", text, present), []);
});

test("fails a picture that is neither beside the article nor in docs/images", async () => {
  const problems = await checkArticleLinks("a-piece.md", "![A cover](../../assets/cover.png)", present);

  assert.equal(problems.length, 1);
  assert.match(problems[0], /belong beside it in docs\/articles\//u);
  assert.match(problems[0], /a-piece\.md/u);
});

test("fails a picture that is not in the repository", async () => {
  const problems = await checkArticleLinks("a-piece.md", "![A cover](a-piece-cover.png)", absent);

  assert.equal(problems.length, 1);
  assert.match(problems[0], /is not in the repository/u);
  assert.match(problems[0], /docs\/articles\/a-piece-cover\.png/u);
});

test("a repository with no articles passes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-articles-"));
  try {
    assert.deepEqual(await checkAll(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reads the real articles of a repository, and names the one that is wrong", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-articles-"));
  try {
    await mkdir(path.join(root, "docs", "articles"), { recursive: true });
    await writeFile(path.join(root, "docs", "articles", "good.md"), "![A cover](good-cover.png)\n", "utf8");
    await writeFile(path.join(root, "docs", "articles", "good-cover.png"), "not really a picture", "utf8");
    await writeFile(path.join(root, "docs", "articles", "bad.md"), "![A cover](missing-cover.png)\n", "utf8");

    const problems = await checkAll(root);

    assert.equal(problems.length, 1);
    assert.match(problems[0], /^bad\.md/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("this repository's own articles pass", async () => {
  assert.deepEqual(await checkAll(), []);
});
