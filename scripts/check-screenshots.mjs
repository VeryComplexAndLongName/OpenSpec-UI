#!/usr/bin/env node
// Every picture in the documentation is either taken by an end-to-end
// capture or listed as one no capture can take.
//
// `openspec/specs/openspec-workbench/spec.md` has required the first
// half since it was written: "a hand-taken screenshot goes stale
// silently: the screen changes, the picture does not, and nothing
// fails." What was missing is the thing that fails. Twenty of the
// twenty-six pictures in `docs/images/` predate the requirement, most of
// them last touched on 22 August, and nothing said so.
//
// The check reads the capture sources rather than a list of expected
// pictures, so a capture added by another change is found without this
// script being updated — `pipeline.spec.ts` arrived that way while this
// was being written. See every-screenshot-is-taken-by-a-spec.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Why a picture exists that no capture can produce. A closed set: a
 * reason nobody can spell freely is a reason a reviewer can read down a
 * column of.
 *
 * `editor-native` — a surface the editor itself draws (a tree view, a
 * context menu, a quick pick), which no browser can reach.
 * `external-product` — a picture of something that is not this product.
 * `published-asset` — an image made for a post published elsewhere,
 * which this repository's documentation does not reference. It is kept
 * because it was published, not because anything here shows it; the
 * alternative is deleting it. Added during implementation: the four
 * `docs/images/standalone/0*.png` files are exactly this, and calling
 * them editor-native would have been a lie a reviewer could not see
 * through. */
export const BASELINE_REASONS = new Set(["editor-native", "external-product", "published-asset"]);

const IMAGES_DIR = path.join("docs", "images");
const CAPTURE_DIR = path.join("packages", "server", "e2e");
const BASELINE_FILE = path.join("scripts", "screenshot-baseline.json");

/** Repository-relative, forward-slashed — the spelling the baseline
 * file and every message use, so a path never reads differently on
 * Windows than it does in CI. */
function repoPath(...segments) {
  return segments.join("/").replaceAll("\\", "/");
}

async function walkImages(root) {
  const found = [];
  async function walk(relative) {
    let entries;
    try {
      entries = await readdir(path.join(root, relative), { withFileTypes: true });
    } catch {
      // No images directory at all is not a failure: a repository with
      // no pictures satisfies this trivially.
      return;
    }
    for (const entry of entries) {
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (entry.name.toLowerCase().endsWith(".png")) found.push(repoPath(next));
    }
  }
  await walk(IMAGES_DIR);
  return found.sort();
}

/** Which pictures a capture source writes.
 *
 * Deliberately not a TypeScript parser. A capture names its directory
 * once (`path.join(..., "docs", "images", "standalone")`) and each
 * picture as a string literal, so the file's own text answers the
 * question: which images directory this spec writes into, and which
 * `.png` names it mentions. A spec that named a directory some other
 * way would be reported as producing nothing, which fails loudly on the
 * pictures it takes rather than passing them silently. */
export function capturedBy(source) {
  const directories = new Set();
  const directoryPattern = /"docs"\s*,\s*"images"\s*,\s*"([A-Za-z0-9._-]+)"/gu;
  for (const match of source.matchAll(directoryPattern)) {
    if (match[1]) directories.add(match[1]);
  }

  const names = new Set();
  for (const match of source.matchAll(/"([A-Za-z0-9._-]+\.png)"/gu)) {
    if (match[1]) names.add(match[1]);
  }

  const produced = [];
  for (const directory of directories) {
    for (const name of names) produced.push(repoPath(IMAGES_DIR, directory, name));
  }
  return produced.sort();
}

async function readCaptures(root) {
  const byPicture = new Map();
  let entries;
  try {
    entries = await readdir(path.join(root, CAPTURE_DIR), { withFileTypes: true });
  } catch {
    return byPicture;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".spec.ts")) continue;
    const source = await readFile(path.join(root, CAPTURE_DIR, entry.name), "utf8");
    for (const picture of capturedBy(source)) {
      byPicture.set(picture, repoPath(CAPTURE_DIR, entry.name));
    }
  }
  return byPicture;
}

/** One listed picture: where it is, why no capture takes it, and when it
 * was last taken by hand. A reader of the list can see the whole
 * exception surface of this repository in one file. */
export function readBaseline(source, file = BASELINE_FILE) {
  const problems = [];
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    return { entries: [], problems: [`${file}: not readable as JSON (${error instanceof Error ? error.message : String(error)})`] };
  }
  if (!Array.isArray(parsed)) {
    return { entries: [], problems: [`${file}: must be an array of entries`] };
  }

  const entries = [];
  for (const [index, entry] of parsed.entries()) {
    const at = `${file}[${index}]`;
    if (typeof entry?.path !== "string" || entry.path.length === 0) {
      problems.push(`${at}: needs a "path"`);
      continue;
    }
    if (!BASELINE_REASONS.has(entry.reason)) {
      problems.push(
        `${at} (${entry.path}): "${entry.reason}" is not a reason a picture may be listed for`
        + ` — one of ${[...BASELINE_REASONS].sort().join(", ")}`,
      );
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(entry.captured ?? "")) {
      problems.push(`${at} (${entry.path}): needs "captured" as an ISO date, so a reader can tell how old the picture is`);
      continue;
    }
    entries.push({ path: entry.path, reason: entry.reason, captured: entry.captured });
  }
  return { entries, problems };
}

export async function checkScreenshots(root = repoRoot) {
  const problems = [];

  const pictures = await walkImages(root);
  const captures = await readCaptures(root);

  let baseline = { entries: [], problems: [] };
  try {
    baseline = readBaseline(await readFile(path.join(root, BASELINE_FILE), "utf8"));
  } catch {
    // No baseline is a repository where every picture is captured. That
    // is the state this check exists to move towards, not a failure.
  }
  problems.push(...baseline.problems);

  const listed = new Map(baseline.entries.map((entry) => [entry.path, entry]));

  for (const picture of pictures) {
    if (captures.has(picture) || listed.has(picture)) continue;
    problems.push(
      `${picture}: no capture writes it and it is not listed in ${repoPath(BASELINE_FILE)}`
      + " — add a capture under packages/server/e2e, or list it with the reason no capture can",
    );
  }

  const present = new Set(pictures);
  for (const entry of listed.values()) {
    if (present.has(entry.path)) continue;
    problems.push(
      `${repoPath(BASELINE_FILE)}: "${entry.path}" is listed but no such picture is in the repository`
      + " — a list that outlives what it describes stops describing it",
    );
  }

  return { problems, pictures, captures, listed };
}

async function main() {
  const { problems, pictures, captures, listed } = await checkScreenshots();
  if (problems.length > 0) {
    console.error("Screenshot check failed:\n");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }

  console.log(
    `Screenshot check passed. ${pictures.length} pictures:`
    + ` ${captures.size} captured, ${listed.size} listed as hand-taken.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await stat(repoRoot);
  await main();
}
