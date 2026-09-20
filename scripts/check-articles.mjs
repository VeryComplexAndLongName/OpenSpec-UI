#!/usr/bin/env node
// Every picture an article links exists, and is where articles keep
// pictures (an-article-is-editorial-not-a-change).
//
// `docs/articles/` is the one directory in this repository exempt from
// the OpenSpec change rule: what lives there is editorial, not a
// description of how the product behaves. The exemption costs something -
// nobody reviews an article against a spec - so the two mistakes a writer
// makes without one are checked here instead:
//
// - a link to a picture that is not in the repository at all, which
//   renders as a broken image on GitHub and in every reader's feed;
// - a picture put under `docs/images/`, which `lint:screenshots` governs:
//   every picture there must come from an end-to-end capture, and a cover
//   drawn by hand fails that check with a message about capture specs
//   that says nothing to whoever wrote the article.
//
// Linking a picture that `docs/images/` already holds is fine, and is the
// point: an article showing the product should show what a capture took,
// not a hand-made drawing of it.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_DIR = path.join("docs", "articles");
const IMAGES_DIR = path.join("docs", "images");

/** A markdown image, `![alt](target)`, and a bare `<img src="...">`. Both
 * are what a writer reaches for; neither is exotic enough to leave out. */
const IMAGE_PATTERNS = [
  /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu,
  /<img[^>]+src="([^"]+)"/gu,
];

/** Every picture an article's text links, in the order it links them. */
export function imageLinksIn(text) {
  const links = [];
  for (const pattern of IMAGE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const target = match[1];
      if (target !== undefined) links.push(target);
    }
  }
  return links;
}

/** Whether a link points outside this repository, and so is nothing this
 * check can look at. */
export function isRemote(target) {
  return /^[a-z][a-z0-9+.-]*:/iu.test(target) || target.startsWith("//");
}

/** What is wrong with one article's links, as messages. `exists` answers
 * whether a repository-relative path is a file, so the check is testable
 * without a repository. */
export async function checkArticleLinks(articleName, text, exists) {
  const problems = [];
  for (const target of imageLinksIn(text)) {
    if (isRemote(target) || target.startsWith("#")) continue;
    const withoutAnchor = target.split("#")[0] ?? target;
    if (withoutAnchor.length === 0) continue;
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(`${ARTICLES_DIR.split(path.sep).join("/")}/${articleName}`), withoutAnchor),
    );
    const inArticles = resolved.startsWith(`${ARTICLES_DIR.split(path.sep).join("/")}/`);
    const inImages = resolved.startsWith(`${IMAGES_DIR.split(path.sep).join("/")}/`);
    if (!inArticles && !inImages) {
      problems.push(
        `${articleName} links "${target}", which resolves to ${resolved}: an article's pictures belong beside it in docs/articles/, or in docs/images/ where a capture put them.`,
      );
      continue;
    }
    if (!await exists(resolved)) {
      problems.push(`${articleName} links "${target}", and ${resolved} is not in the repository.`);
    }
  }
  return problems;
}

/** Every article under `docs/articles/`, at any depth, as a path
 * relative to it.
 *
 * To any depth because the campaign gives the directory one subdirectory
 * per venue. A check that read only the root would have stopped seeing
 * every article the moment they moved, and passed for ever
 * (an-article-directory-per-venue). */
async function articleNames(directory, within = "") {
  let entries;
  try {
    entries = await readdir(path.join(directory, within), { withFileTypes: true });
  } catch {
    return [];
  }
  const names = [];
  for (const entry of entries) {
    const next = within.length === 0 ? entry.name : `${within}/${entry.name}`;
    if (entry.isDirectory()) names.push(...await articleNames(directory, next));
    else if (entry.name.toLowerCase().endsWith(".md")) names.push(next);
  }
  return names.sort();
}

/** Every problem across every article. A repository with no articles has
 * none: an empty subject is not a broken check. */
export async function checkAll(root = repoRoot) {
  const directory = path.join(root, ARTICLES_DIR);
  const names = await articleNames(directory);
  const exists = async (relative) => {
    try {
      return (await stat(path.join(root, relative))).isFile();
    } catch {
      return false;
    }
  };
  const problems = [];
  for (const name of names) {
    const text = await readFile(path.join(directory, name), "utf8");
    problems.push(...await checkArticleLinks(name, text, exists));
  }
  return problems;
}

const invokedDirectly = process.argv[1] !== undefined
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const problems = await checkAll();
  if (problems.length > 0) {
    for (const problem of problems) console.error(`check-articles: ${problem}`);
    process.exitCode = 1;
  } else {
    console.log("Article check passed.");
  }
}
