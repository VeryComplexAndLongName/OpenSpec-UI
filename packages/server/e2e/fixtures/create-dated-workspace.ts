import { mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gitIsolationArgs } from "@openspec-ui/core/test-support/git-isolation";

const run = promisify(execFile);

/** A workspace whose changes have a history, because the charts read one.
 *
 * The dates come from commits — the commit that added a change's
 * `proposal.md`, and the one that moved it under `archive/` — so a
 * fixture without git carries no dates at all and the charts correctly
 * draw nothing. That makes a fine test and a useless screenshot, which
 * is why this exists beside `create-lifecycle-workspace.ts` rather than
 * replacing it. See charts-over-what-happened.
 */
export interface DatedChange {
  name: string;
  /** `YYYY-MM-DD`, the day its proposal is committed. */
  proposedOn: string;
  /** `HH:MM` UTC of that commit. The comparison places a bar by the hour
   * as well as the day, so a fixture whose changes all begin at ten
   * o'clock draws every bar from the same place
   * (the-timeline-compares-changes). */
  proposedAt?: string;
  /** `YYYY-MM-DD`, the day it is moved under `archive/`. Omit to leave
   * the change active. */
  archivedOn?: string;
  /** `HH:MM` UTC of the archiving commit. */
  archivedAt?: string;
  /** How long its checklist is, and how much of it is ticked. One ticked
   * item by default. */
  tasks?: { total: number; done: number };
}

/** The instant a change's proposal or archive is committed at. */
function commitAt(day: string, time: string | undefined, fallback: string): string {
  return `${day}T${time ?? fallback}:00Z`;
}

function tasksMarkdown(tasks: DatedChange["tasks"]): string {
  const total = tasks?.total ?? 1;
  const done = Math.min(tasks?.done ?? total, total);
  const lines = Array.from({ length: total }, (_, index) => `- [${index < done ? "x" : " "}] ${index + 1}.1 Task ${index + 1}`);
  return `## Tasks\n\n${lines.join("\n")}\n`;
}

async function git(cwd: string, args: string[], isoDate?: string): Promise<void> {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.com",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.com",
    ...(isoDate ? { GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate } : {}),
  };
  // The author and the committer came from the environment here and the
  // rest of the configuration came from the developer's machine, so this
  // fixture failed to commit at all where `commit.gpgsign` or
  // `core.hooksPath` is set globally.
  await run("git", [...(await gitIsolationArgs()), ...args], { cwd, env });
}

async function writeChange(workspaceRoot: string, change: DatedChange): Promise<string> {
  const changeRoot = path.join(workspaceRoot, "openspec", "changes", change.name);
  await mkdir(path.join(changeRoot, "specs", change.name), { recursive: true });
  await Promise.all([
    writeFile(path.join(changeRoot, ".openspec.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(path.join(changeRoot, "proposal.md"), `## Why\n\n${change.name}.\n`, "utf8"),
    writeFile(path.join(changeRoot, "tasks.md"), tasksMarkdown(change.tasks), "utf8"),
    writeFile(
      path.join(changeRoot, "specs", change.name, "spec.md"),
      "## ADDED Requirements\n\n### Requirement: Fixture\nThe system SHALL load.\n",
      "utf8",
    ),
  ]);
  return changeRoot;
}

export async function createDatedWorkspace(changes: readonly DatedChange[]): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-dated-"));
  await mkdir(path.join(workspaceRoot, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  await git(workspaceRoot, ["init", "-q"]);
  await git(workspaceRoot, ["add", "."]);
  await git(workspaceRoot, ["commit", "-q", "-m", "workspace"], "2026-01-01T09:00:00Z");

  const proposing = [...changes].sort((a, b) =>
    commitAt(a.proposedOn, a.proposedAt, "10:00").localeCompare(commitAt(b.proposedOn, b.proposedAt, "10:00")));
  for (const change of proposing) {
    await writeChange(workspaceRoot, change);
    await git(workspaceRoot, ["add", "."]);
    await git(workspaceRoot, ["commit", "-q", "-m", `propose ${change.name}`], commitAt(change.proposedOn, change.proposedAt, "10:00"));
  }

  const archiving = changes
    .filter((change): change is DatedChange & { archivedOn: string } => change.archivedOn !== undefined)
    .sort((a, b) =>
      commitAt(a.archivedOn, a.archivedAt, "16:00").localeCompare(commitAt(b.archivedOn, b.archivedAt, "16:00")));
  for (const change of archiving) {
    const from = path.join(workspaceRoot, "openspec", "changes", change.name);
    const to = path.join(workspaceRoot, "openspec", "changes", "archive", `${change.archivedOn}-${change.name}`);
    await mkdir(path.dirname(to), { recursive: true });
    await rename(from, to);
    await git(workspaceRoot, ["add", "-A"]);
    await git(workspaceRoot, ["commit", "-q", "-m", `archive ${change.name}`], commitAt(change.archivedOn, change.archivedAt, "16:00"));
  }

  return workspaceRoot;
}
