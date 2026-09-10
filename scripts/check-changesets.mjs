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

/** The `name` of every package in the workspace, read from the same
 * `workspaces` globs npm itself resolves — a hard-coded list here would
 * be a second place to forget a new package. */
export async function workspacePackageNames(root = repoRoot) {
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const names = new Set();
  for (const pattern of manifest.workspaces ?? []) {
    // The only shape this repository uses: `packages/*`.
    const [dir, star] = pattern.split("/");
    if (star !== "*") {
      names.add(JSON.parse(await readFile(path.join(root, pattern, "package.json"), "utf8")).name);
      continue;
    }
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        names.add(JSON.parse(await readFile(path.join(root, dir, entry.name, "package.json"), "utf8")).name);
      } catch {
        // A directory without a package.json is not a package.
      }
    }
  }
  return names;
}

/** One `name: bump` entry, in the three spellings a changeset's
 * frontmatter can carry.
 *
 * All three are valid YAML and all three are accepted by `changeset
 * version`, so all three are the lint's business. Reading only the
 * double-quoted form is what let `openspec-ui-vscode: patch` — bare, and
 * misspellable — through unread, which is the exact failure this script
 * exists to catch.
 *
 * Still deliberately not a YAML parser: the frontmatter of a changeset
 * is a flat list of these, and a parser dependency for three shapes
 * remains the larger risk. What is new is that a line matching none of
 * the three is refused rather than skipped, so "the lint read nothing
 * here" can no longer look like "the lint found nothing wrong here". */
const NAME_ENTRY = /^\s*(?:"([^"]*)"|'([^']*)'|([^\s'"#][^:]*?))\s*:\s*(\S.*?)\s*$/u;

/** The names a changeset's frontmatter states, and the lines of it that
 * could not be read at all. `label` names the file in a problem. */
export function readChangesetFrontmatter(label, source) {
  const names = [];
  const problems = [];
  const end = source.indexOf("\n---", 3);
  if (!source.startsWith("---") || end === -1) return { names, problems };

  const lines = source.slice(3, end).split("\n");
  for (const [index, line] of lines.entries()) {
    // Line 1 is the opening `---`, so the first frontmatter line is 2.
    const lineNumber = index + 2;
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const match = NAME_ENTRY.exec(line);
    const name = match ? (match[1] ?? match[2] ?? match[3] ?? "").trim() : "";
    if (name.length === 0) {
      problems.push(`${label}:${lineNumber}: not a \`name: bump\` entry, so no name was read from it: ${trimmed}`);
      continue;
    }
    names.push(name);
  }
  return { names, problems };
}

export async function checkChangesets(root = repoRoot) {
  const known = await workspacePackageNames(root);
  const problems = [];

  let entries = [];
  try {
    entries = await readdir(path.join(root, ".changeset"));
  } catch {
    // No `.changeset` directory: nothing to check, and not this script's
    // business to complain about that.
  }

  for (const entry of entries.sort()) {
    if (!entry.endsWith(".md") || entry === "README.md") continue;
    const label = `.changeset/${entry}`;
    const source = await readFile(path.join(root, ".changeset", entry), "utf8");
    const { names, problems: unreadable } = readChangesetFrontmatter(label, source);
    problems.push(...unreadable);
    for (const name of names) {
      if (!known.has(name)) {
        problems.push(`${label}: "${name}" is not a package in this workspace`);
      }
    }
  }

  return { problems, known };
}

async function main() {
  const { problems, known } = await checkChangesets();
  if (problems.length > 0) {
    console.error("Changeset check failed:\n");
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`\nWorkspace packages: ${[...known].sort().join(", ")}`);
    process.exit(1);
  }

  console.log("Changeset check passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
