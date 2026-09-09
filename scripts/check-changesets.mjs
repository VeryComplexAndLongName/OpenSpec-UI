#!/usr/bin/env node
// Every package a changeset names must be a package this workspace has.
//
// `changeset version` fails outright on a name it cannot find — "Found
// changeset <id> for package <name> which is not in the workspace" — and
// it fails on `main`, after the merge, in the one job that pull requests
// skip. A changeset naming `@openspec-ui/extension` (the directory) rather
// than `openspec-ui-vscode` (the package) went in on 2026-09-09 and broke
// every release run for three merges before anyone looked.
//
// It costs one file read per changeset to know before the merge.
// See changeset-names-a-real-package.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const changesetDir = path.join(repoRoot, ".changeset");

/** The `name` of every package in the workspace, read from the same
 * `workspaces` globs npm itself resolves — a hard-coded list here would
 * be a second place to forget a new package. */
async function workspacePackageNames() {
  const root = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const names = new Set();
  for (const pattern of root.workspaces ?? []) {
    // The only shape this repository uses: `packages/*`.
    const [dir, star] = pattern.split("/");
    if (star !== "*") {
      names.add(JSON.parse(await readFile(path.join(repoRoot, pattern, "package.json"), "utf8")).name);
      continue;
    }
    for (const entry of await readdir(path.join(repoRoot, dir), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        names.add(JSON.parse(await readFile(path.join(repoRoot, dir, entry.name, "package.json"), "utf8")).name);
      } catch {
        // A directory without a package.json is not a package.
      }
    }
  }
  return names;
}

/** The quoted names in a changeset's frontmatter. Deliberately not a YAML
 * parser: the frontmatter of a changeset is a list of `"name": bump`
 * lines, and a dependency on a parser for that would be the larger
 * risk. */
function packagesNamedIn(source) {
  const end = source.indexOf("\n---", 3);
  if (!source.startsWith("---") || end === -1) return [];
  return [...source.slice(3, end).matchAll(/^\s*"([^"]+)"\s*:/gmu)].map((match) => match[1]);
}

const known = await workspacePackageNames();
const problems = [];

let entries = [];
try {
  entries = await readdir(changesetDir);
} catch {
  // No `.changeset` directory: nothing to check, and not this script's
  // business to complain about that.
}

for (const entry of entries) {
  if (!entry.endsWith(".md") || entry === "README.md") continue;
  const source = await readFile(path.join(changesetDir, entry), "utf8");
  for (const name of packagesNamedIn(source)) {
    if (!known.has(name)) {
      problems.push(`.changeset/${entry}: "${name}" is not a package in this workspace`);
    }
  }
}

if (problems.length > 0) {
  console.error("Changeset check failed:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`\nWorkspace packages: ${[...known].sort().join(", ")}`);
  process.exit(1);
}

console.log("Changeset check passed.");
