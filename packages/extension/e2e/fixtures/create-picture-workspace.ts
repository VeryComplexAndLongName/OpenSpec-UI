// The workspace the editor pictures are taken against.
//
// A fixture, never this repository: a picture taken against live
// contents changes when the work changes rather than when the screen
// does, and would carry whatever happened to be in flight that day.
//
// Its directory name is FIXED — the editor shows the workspace name in
// its title bar and as the Explorer root, so a fixed name keeps the
// account name out of the picture rather than masking it afterwards.
// The temporary holder above it is random; the workspace inside is not.

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { gitIsolationArgs } from "@openspec-ui/core/test-support/git-isolation";

const run = promisify(execFile);

/** git with this machine's own signing and hooks settings kept out, the
 * way the standalone Pipeline fixture commits. */
async function git(cwd: string, args: string[]): Promise<void> {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.com",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.com",
  };
  await run("git", [...(await gitIsolationArgs()), ...args], { cwd, env });
}

/** What the title bar and Explorer root will read. Chosen to be what a
 * reader would expect a workspace to be called, since it is visible in
 * every picture. */
export const WORKSPACE_NAME = "openspec-workbench";

export interface PictureWorkspace {
  /** The workspace to open. */
  path: string;
  /** The random directory above it, to remove afterwards. */
  holder: string;
}

async function write(file: string, contents: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents, "utf8");
}

export async function createPictureWorkspace(): Promise<PictureWorkspace> {
  const holder = await mkdtemp(path.join(os.tmpdir(), "openspec-pictures-"));
  const root = path.join(holder, WORKSPACE_NAME);

  // A real OpenSpec workspace: without config.yaml the Changes view
  // leads with "OpenSpec Configuration missing", which is a true thing
  // to show and not what these pictures are of.
  await write(path.join(root, "openspec", "config.yaml"), [
    "context: |",
    "  A fixture workspace. Its contents are fixed so that a difference",
    "  in a picture is a difference in the product.",
    "",
  ].join("\n"));

  await write(path.join(root, "openspec", "project.md"), "# A fixture project\n");

  // Two active changes, one of them with tasks at several states, since
  // `nested-tasks.png` is a picture of exactly that.
  await write(path.join(root, "openspec", "changes", "a-change-in-progress", "proposal.md"), [
    "# A change in progress",
    "",
    "## Why",
    "",
    "To show what a change looks like while it is being worked on.",
    "",
    "## What Changes",
    "",
    "- A view gains the thing this picture shows.",
    "",
  ].join("\n"));
  await write(path.join(root, "openspec", "changes", "a-change-in-progress", "design.md"), [
    "# Design",
    "",
    "## Decision: the fixture is fixed",
    "",
    "So that a changed picture means a changed product.",
    "",
  ].join("\n"));
  await write(path.join(root, "openspec", "changes", "a-change-in-progress", "tasks.md"), [
    "## 1. The first part",
    "",
    "- [x] 1.1 Something already done",
    "- [x] 1.2 Something else already done",
    "- [ ] 1.3 Something still open",
    "",
    "## 2. The second part",
    "",
    "- [ ] 2.1 Not started",
    "- [ ] 2.2 **Human-only.** Whether the picture reads as the product does.",
    "- [ ] 2.3 **Delegated to claude-cli.** A live check against a real workspace.",
    "",
  ].join("\n"));
  await write(
    path.join(root, "openspec", "changes", "a-change-in-progress", "specs", "a-capability", "spec.md"),
    "## ADDED Requirements\n\n### Requirement: Something is required\n\nIt SHALL hold.\n\n#### Scenario: It holds\n\n- **WHEN** asked\n- **THEN** it holds\n",
  );

  await write(path.join(root, "openspec", "changes", "a-change-not-started", "proposal.md"), [
    "# A change not started",
    "",
    "## Why",
    "",
    "To show a second row, so the view is not a picture of one thing.",
    "",
    "## What Changes",
    "",
    "- Nothing yet.",
    "",
  ].join("\n"));
  await write(path.join(root, "openspec", "changes", "a-change-not-started", "tasks.md"), "- [ ] 1.1 Not started\n");

  // An archived change, because `archive-actions.png` and
  // `archive-tasks.png` are pictures of the Archive view.
  const archived = path.join(root, "openspec", "changes", "archive", "2026-08-01-a-change-that-shipped");
  await write(path.join(archived, "proposal.md"), [
    "# A change that shipped",
    "",
    "## Why",
    "",
    "To fill the Archive view.",
    "",
    "## What Changes",
    "",
    "- It shipped.",
    "",
  ].join("\n"));
  await write(path.join(archived, "tasks.md"), "- [x] 1.1 Done\n- [x] 1.2 Also done\n");

  // A branch of the relation whose every change has landed, so the
  // Change Graph has something to fold, and a live change waiting on
  // another, so it has something to draw
  // (the-pictures-show-what-is-drawn-now).
  const foundation = path.join(root, "openspec", "changes", "archive", "2026-06-01-a-foundation");
  await write(path.join(foundation, "proposal.md"), "# A foundation\n\n## Why\n\nThe branch this one starts.\n");
  await write(path.join(foundation, "tasks.md"), "- [x] 1.1 Done\n");
  await write(path.join(foundation, ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-06-01\n");
  const earlier = path.join(root, "openspec", "changes", "archive", "2026-07-01-an-earlier-change");
  await write(path.join(earlier, "proposal.md"), "# An earlier change\n\n## Why\n\nIt follows the foundation.\n");
  await write(path.join(earlier, "tasks.md"), "- [x] 1.1 Done\n");
  await write(path.join(earlier, ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-07-01\nfollows: a-foundation\n");
  await write(
    path.join(root, "openspec", "changes", "a-change-in-progress", ".openspec.yaml"),
    "schema: spec-driven\ncreated: 2026-08-20\nblocked_by: a-change-not-started\n",
  );

  // What the archive leaves behind: one directory the sweep clears,
  // because its change is archived and it holds only a file this product
  // wrote, and one it will not, because nothing of that name is archived.
  await write(path.join(root, "openspec", "changes", "a-change-that-shipped", "harness.json"), "{}\n");
  await write(path.join(root, "openspec", "changes", "an-idea-not-written-yet", "harness.json"), "{}\n");

  // Two capabilities, so the Specs view shows a list rather than a row.
  await write(path.join(root, "openspec", "specs", "a-capability", "spec.md"), [
    "# a-capability",
    "",
    "## Purpose",
    "",
    "What this capability is for.",
    "",
    "## Requirements",
    "",
    "### Requirement: Something is required",
    "",
    "It SHALL hold.",
    "",
    "#### Scenario: It holds",
    "",
    "- **WHEN** asked",
    "- **THEN** it holds",
    "",
  ].join("\n"));
  await write(path.join(root, "openspec", "specs", "another-capability", "spec.md"), [
    "# another-capability",
    "",
    "## Purpose",
    "",
    "A second one, so the view is a list.",
    "",
    "## Requirements",
    "",
    "### Requirement: A second requirement",
    "",
    "It SHALL also hold.",
    "",
    "#### Scenario: It also holds",
    "",
    "- **WHEN** asked",
    "- **THEN** it also holds",
    "",
  ].join("\n"));

  // A git repository, committed once, with no remote. The Changes tree
  // states a change's standing only where it can read one, and a standing
  // is read from git; without a repository every row lists its change
  // with no word, which is not what `changes-standings.png` is of. See
  // the-docs-catch-up-to-0-55.
  await git(root, ["init", "-q", "-b", "main"]);
  await git(root, ["add", "."]);
  await git(root, ["commit", "-q", "-m", "fixture"]);

  return { path: root, holder };
}
