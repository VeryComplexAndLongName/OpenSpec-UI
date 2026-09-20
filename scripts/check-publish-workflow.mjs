#!/usr/bin/env node
// The Marketplace publish stays a step somebody asks for
// (the-marketplace-publish-is-a-manual-step).
//
// Every other guarantee in this repository is a test over code. This one
// lives in a YAML file that nothing else reads, and the failure mode is
// the one the owner asked to prevent: a publish that goes out on a push
// because a trigger was added while debugging, or a second workflow that
// quietly learns the token.
//
// So this reads the workflow and fails where it stops being what the
// change decided: dispatched by hand and by nothing else, confirmed by a
// typed word, publishing the artifact that was released rather than a
// rebuild, with the token read by that one job and named nowhere else.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PUBLISH_WORKFLOW = ".github/workflows/publish-marketplace.yml";

/** The lines of a workflow, with comments and blank lines dropped: every
 * rule below is about what the file does, and a comment quoting a trigger
 * is not a trigger. */
function instructions(source) {
  return source
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0 && !line.trim().startsWith("#"));
}

/** The top-level `on:` block's keys. A workflow's triggers are the only
 * thing here that has to be exhaustive, so they are read as keys rather
 * than searched for as words. */
function triggersOf(lines) {
  const start = lines.findIndex((line) => /^on:\s*$/u.test(line) || /^on:\s*\S/u.test(line));
  if (start === -1) return [];
  const inline = /^on:\s*(\S.*)$/u.exec(lines[start]);
  if (inline) return [inline[1].trim()];
  const triggers = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/u.test(line)) break;
    const match = /^ {2}([A-Za-z_]+):/u.exec(line);
    if (match) triggers.push(match[1]);
  }
  return triggers;
}

export function checkPublishWorkflow(source) {
  const problems = [];
  const lines = instructions(source);
  const text = lines.join("\n");

  const triggers = triggersOf(lines);
  if (triggers.length === 0) {
    problems.push("it declares no trigger at all");
  }
  for (const trigger of triggers) {
    if (trigger !== "workflow_dispatch") {
      problems.push(`it runs on "${trigger}"; a publish is dispatched by hand and by nothing else`);
    }
  }

  if (!/^ {6}confirm:/mu.test(text)) {
    problems.push('it takes no "confirm" input; the press has to be deliberate');
  }
  if (!/!=\s*"publish"/u.test(text) && !/!=\s*'publish'/u.test(text)) {
    problems.push('no step refuses a run whose confirmation does not read "publish"');
  }
  if (!/^ {6}version:/mu.test(text)) {
    problems.push('it takes no "version" input; a publish names the version it publishes');
  }
  if (!text.includes("gh release download")) {
    problems.push("it does not take the VSIX from the release that version was tagged as");
  }
  if (!/vsce publish[^\n]*--packagePath/u.test(text)) {
    problems.push("its publish does not take --packagePath; what goes out must be the artifact that was released");
  }
  if (/vsce package|npm run package/u.test(text)) {
    problems.push("it builds a package of its own rather than publishing the released one");
  }
  if (!text.includes("VSCE_PAT")) {
    problems.push("it reads no VSCE_PAT; nothing would authenticate");
  }

  return problems;
}

/** Every other workflow, which may name neither the token nor a publish:
 * a second path to the Marketplace is exactly what "a manual step" rules
 * out, and it would not be visible from the file above. */
/** The one workflow allowed to name the homepage's dispatch token. */
const DISPATCH_WORKFLOW = ".github/workflows/homepage-dispatch.yml";

export async function checkOtherWorkflows(root = repoRoot) {
  const problems = [];
  const directory = path.join(root, ".github", "workflows");
  let entries = [];
  try {
    entries = await readdir(directory);
  } catch {
    return [".github/workflows is not readable"];
  }
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".yml") && !entry.endsWith(".yaml")) continue;
    const relative = `.github/workflows/${entry}`;
    if (relative === PUBLISH_WORKFLOW) continue;
    const source = await readFile(path.join(directory, entry), "utf8");
    const text = instructions(source).join("\n");
    if (text.includes("VSCE_PAT")) {
      problems.push(`${relative}: names VSCE_PAT; the token is read by the publishing workflow alone`);
    }
    // The same rule for the other credential this repository holds: a
    // token that can act on another repository is named by the one
    // workflow that needs it (the-homepage-hears-about-an-article).
    if (relative !== DISPATCH_WORKFLOW && text.includes("HOMEPAGE_DISPATCH_TOKEN")) {
      problems.push(`${relative}: names HOMEPAGE_DISPATCH_TOKEN; the token is read by the homepage dispatch workflow alone`);
    }
    if (/vsce publish/u.test(text)) {
      problems.push(`${relative}: publishes to the Marketplace; that is the dispatched workflow's alone`);
    }
  }
  return problems;
}

export async function checkAll(root = repoRoot) {
  const problems = [];
  let source;
  try {
    source = await readFile(path.join(root, PUBLISH_WORKFLOW), "utf8");
  } catch {
    return [`${PUBLISH_WORKFLOW} is missing; the Marketplace publish lives there`];
  }
  problems.push(...checkPublishWorkflow(source).map((problem) => `${PUBLISH_WORKFLOW}: ${problem}`));
  problems.push(...(await checkOtherWorkflows(root)));
  return problems;
}

async function main() {
  const problems = await checkAll();
  if (problems.length > 0) {
    console.error("Publish workflow check failed:\n");
    for (const problem of problems) console.error(`  ${problem}`);
    console.error("\nSee openspec/changes/the-marketplace-publish-is-a-manual-step/design.md");
    process.exit(1);
  }
  console.log("Publish workflow check passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
