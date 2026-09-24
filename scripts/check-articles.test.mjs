import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkAll, checkArticleLinks, imageLinksIn, isRemote, isSvg } from "./check-articles.mjs";

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

// an-article-directory-per-venue: one subdirectory per venue, and a
// shared directory for the pictures more than one article uses.
test("reads an article in a venue subdirectory, and names it by its path", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-articles-"));
  try {
    await mkdir(path.join(root, "docs", "articles", "linkedin"), { recursive: true });
    await writeFile(path.join(root, "docs", "articles", "linkedin", "a-post.md"), "![A cover](missing.png)\n", "utf8");

    const problems = await checkAll(root);

    assert.equal(problems.length, 1);
    assert.match(problems[0], /^linkedin\/a-post\.md/u);
    assert.match(problems[0], /docs\/articles\/linkedin\/missing\.png is not in the repository/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("passes a cover beside an article in its venue, and one in shared", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-articles-"));
  try {
    await mkdir(path.join(root, "docs", "articles", "devto"), { recursive: true });
    await mkdir(path.join(root, "docs", "articles", "shared"), { recursive: true });
    await writeFile(path.join(root, "docs", "articles", "devto", "a-post-cover.png"), "x", "utf8");
    await writeFile(path.join(root, "docs", "articles", "shared", "tour.gif"), "x", "utf8");
    await writeFile(
      path.join(root, "docs", "articles", "devto", "a-post.md"),
      "![A cover](a-post-cover.png)\n\n![The tour](../shared/tour.gif)\n",
      "utf8",
    );

    assert.deepEqual(await checkAll(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// an-article-picture-is-never-svg: the site's standard is PNG.
test("knows an SVG by its name, whatever its query or anchor", () => {
  assert.equal(isSvg("diagram.svg"), true);
  assert.equal(isSvg("DIAGRAM.SVG"), true);
  assert.equal(isSvg("https://example.com/diagram.svg?v=2#top"), true);
  assert.equal(isSvg("diagram.png"), false);
  assert.equal(isSvg("an-svg-explained.png"), false);
});

test("fails a link to an SVG, beside the article or remote", async () => {
  const text = [
    "![A diagram](diagram.svg)",
    "![A badge](https://example.com/badge.svg)",
  ].join("\n");

  const problems = await checkArticleLinks("a-piece.md", text, present);

  assert.equal(problems.length, 2);
  assert.match(problems[0], /a-piece\.md links "diagram\.svg", an SVG: an article's pictures are PNG/u);
  assert.match(problems[1], /badge\.svg/u);
});

test("fails an SVG file under docs/articles that nothing links", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-articles-"));
  try {
    await mkdir(path.join(root, "docs", "articles", "site", "a-piece"), { recursive: true });
    await writeFile(path.join(root, "docs", "articles", "site", "a-piece", "diagram.svg"), "<svg/>", "utf8");
    await writeFile(path.join(root, "docs", "articles", "site", "a-piece", "diagram.png"), "x", "utf8");
    await writeFile(path.join(root, "docs", "articles", "site", "a-piece.md"), "![A diagram](a-piece/diagram.png)\n", "utf8");

    const problems = await checkAll(root);

    assert.equal(problems.length, 1);
    assert.match(problems[0], /^site\/a-piece\/diagram\.svg is an SVG/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
