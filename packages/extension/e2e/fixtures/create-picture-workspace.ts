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

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

  return { path: root, holder };
}
