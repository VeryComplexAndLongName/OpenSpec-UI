import { mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gitIsolationArgs } from "@openspec-ui/core/test-support/git-isolation";

const run = promisify(execFile);

/** The archived change the Timeline's one-change picture shows
 * (the-change-timeline-looks-like-the-mockup 5.1). */
export const TIMELINE_CHANGE = "a-run-says-which-task-it-is-on";
export const TIMELINE_ARCHIVE_FOLDER = `2026-09-14-${TIMELINE_CHANGE}`;

async function git(cwd: string, args: string[], isoDate: string): Promise<void> {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.com",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.com",
    GIT_AUTHOR_DATE: isoDate,
    GIT_COMMITTER_DATE: isoDate,
  };
  await run("git", [...(await gitIsolationArgs()), ...args], { cwd, env });
}

const TASKS = [
  "1.1 commandInstruction(\"implement\") in the shared agent instructions",
  "1.2 shared.test.ts pins \"Starting task\" in the instruction",
  "2.1 A new file, task-marker.ts, exports a pure parser",
  "2.2 The parser reads a task number",
  "2.3 The parser refuses a number the list does not have",
  "6.2 Run npm run verify unpiped, after the last edit",
  "6.5 Delegated to claude-cli: find out which agents deliver a task marker",
];

function tasksMarkdown(done: number[]): string {
  const lines = TASKS.map((task, index) => `- [${done.includes(index) ? "x" : " "}] ${task}`);
  return `## 1. Tasks\n\n${lines.join("\n")}\n`;
}

/** A workspace whose one change has a history git can read: proposed, five
 * tasks ticked in one commit, one ticked alone, one more, then archived,
 * each commit at a set UTC time. */
export async function createTimelineWorkspace(): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-timeline-"));
  await mkdir(path.join(workspaceRoot, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  await git(workspaceRoot, ["init", "-q"], "2026-09-13T12:00:00Z");
  await git(workspaceRoot, ["add", "."], "2026-09-13T12:00:00Z");
  await git(workspaceRoot, ["commit", "-q", "-m", "workspace"], "2026-09-13T12:00:00Z");

  const changeRoot = path.join(workspaceRoot, "openspec", "changes", TIMELINE_CHANGE);
  await mkdir(path.join(changeRoot, "specs", "agentic-harness"), { recursive: true });
  const tasksPath = path.join(changeRoot, "tasks.md");
  await Promise.all([
    writeFile(path.join(changeRoot, ".openspec.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(path.join(changeRoot, "proposal.md"), "## Why\n\nA run says which task it is on.\n", "utf8"),
    writeFile(path.join(changeRoot, "design.md"), "## Context\n\nA marker in the agent's output.\n", "utf8"),
    writeFile(tasksPath, tasksMarkdown([]), "utf8"),
    writeFile(
      path.join(changeRoot, "specs", "agentic-harness", "spec.md"),
      "## ADDED Requirements\n\n### Requirement: A run names its task\nThe system SHALL name the task a run is on.\n",
      "utf8",
    ),
  ]);
  const commit = async (message: string, at: string) => {
    await git(workspaceRoot, ["add", "-A"], at);
    await git(workspaceRoot, ["commit", "-q", "-m", message], at);
  };
  await commit(`propose ${TIMELINE_CHANGE}`, "2026-09-13T15:40:00Z");

  await writeFile(tasksPath, tasksMarkdown([0, 1, 2, 3, 4]), "utf8");
  await commit("tick five tasks", "2026-09-13T20:16:00Z");
  await writeFile(tasksPath, tasksMarkdown([0, 1, 2, 3, 4, 5]), "utf8");
  await commit("tick 6.2", "2026-09-13T21:13:00Z");
  await writeFile(tasksPath, tasksMarkdown([0, 1, 2, 3, 4, 5, 6]), "utf8");
  await commit("tick 6.5", "2026-09-14T01:40:00Z");

  const archived = path.join(workspaceRoot, "openspec", "changes", "archive", TIMELINE_ARCHIVE_FOLDER);
  await mkdir(path.dirname(archived), { recursive: true });
  await rename(changeRoot, archived);
  // The archive leaves the task list as it was.
  if (!(await readFile(path.join(archived, "tasks.md"), "utf8")).includes("- [x] 6.5")) throw new Error("fixture tasks not ticked");
  await commit(`archive ${TIMELINE_CHANGE}`, "2026-09-14T01:47:00Z");
  return workspaceRoot;
}
