import { mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
  /** `YYYY-MM-DD`, the day it is moved under `archive/`. Omit to leave
   * the change active. */
  archivedOn?: string;
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
  await run("git", args, { cwd, env });
}

async function writeChange(workspaceRoot: string, change: DatedChange): Promise<string> {
  const changeRoot = path.join(workspaceRoot, "openspec", "changes", change.name);
  await mkdir(path.join(changeRoot, "specs", change.name), { recursive: true });
  await Promise.all([
    writeFile(path.join(changeRoot, ".openspec.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(path.join(changeRoot, "proposal.md"), `## Why\n\n${change.name}.\n`, "utf8"),
    writeFile(path.join(changeRoot, "tasks.md"), "## Tasks\n\n- [x] Done\n", "utf8"),
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

  for (const change of [...changes].sort((a, b) => a.proposedOn.localeCompare(b.proposedOn))) {
    await writeChange(workspaceRoot, change);
    await git(workspaceRoot, ["add", "."]);
    await git(workspaceRoot, ["commit", "-q", "-m", `propose ${change.name}`], `${change.proposedOn}T10:00:00Z`);
  }

  const archiving = changes
    .filter((change): change is DatedChange & { archivedOn: string } => change.archivedOn !== undefined)
    .sort((a, b) => a.archivedOn.localeCompare(b.archivedOn));
  for (const change of archiving) {
    const from = path.join(workspaceRoot, "openspec", "changes", change.name);
    const to = path.join(workspaceRoot, "openspec", "changes", "archive", `${change.archivedOn}-${change.name}`);
    await mkdir(path.dirname(to), { recursive: true });
    await rename(from, to);
    await git(workspaceRoot, ["add", "-A"]);
    await git(workspaceRoot, ["commit", "-q", "-m", `archive ${change.name}`], `${change.archivedOn}T16:00:00Z`);
  }

  return workspaceRoot;
}
