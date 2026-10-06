// What a card may do in its change's own worktree, and nowhere else —
// a-card-works-its-own-tasks, ADR 0026 amended 2026-10-05.
//
// A change is worked in the worktree made for it, and until its pull
// request merges it usually exists only there. A person closing a
// Human-only item had to find that worktree's `tasks.md` by hand, edit it,
// commit it and push it. These three functions do that for one change:
// find its own worktree, tick or untick one task with a note under it, and
// commit that `tasks.md` alone and push the branch.
//
// Every one of them takes the change's name and resolves the directory
// itself from `git worktree list`. A path from a request is never written
// to: a request is data from a page, and a change is the pair of a
// directory and a name (ADR 0026).

import { randomUUID } from "node:crypto";
import { access, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { openGit } from "./git-client.js";

import type { AgentRunner } from "./agent-runner.js";
import { readAgentStatuses, resolveAgentStatusDirectory, type AgentStatusReport } from "./agent-status.js";
import { runDelegatedItem, type DelegatedItemRunResult } from "./delegated-item-run.js";
import type { Event } from "./protocol.js";
import { FileAuditLog, auditLogPath, type AuditLog } from "./security.js";
import { changeOfWorktree } from "./change-worktrees.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import { isValidChangeName } from "./change-name.js";
import { parseTaskChecklist, taskNumberOf, TASK_CHECKBOX_LINE_RE, type TaskChecklistItem } from "./task-checklist.js";
import { readWorkspaceLeaseHolder, type WorkspaceLeaseConflict } from "./workspace-lease.js";

/** Why an action on a change's own worktree was not taken. A field rather
 * than a phrase, so a surface can say more where it knows more; `reason` is
 * always the sentence to show. */
export type OwnWorktreeRefusalKind =
  | "no-worktree"
  | "no-task-list"
  | "run-working"
  | "line-changed"
  | "not-a-task"
  | "note-required"
  | "nothing-to-commit"
  | "default-branch"
  | "detached-head"
  | "push-rejected";

export interface OwnWorktreeRefusal {
  ok: false;
  kind: OwnWorktreeRefusalKind;
  reason: string;
}

export interface OwnWorktree {
  ok: true;
  /** The worktree's directory, as git lists it. */
  path: string;
  branch: string;
  /** The change's `tasks.md` in that worktree. */
  tasksPath: string;
  /** The main checkout's branch: the one a commit here is never made on. */
  mainBranch?: string;
}

export interface OwnWorktreeOptions {
  repositoryRoot: string;
  changeName: string;
  /** Test seam; production lists the repository's worktrees. */
  git?: Pick<GitWrapper, "worktreeList">;
}

function refuse(kind: OwnWorktreeRefusalKind, reason: string): OwnWorktreeRefusal {
  return { ok: false, kind, reason };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** The change's own worktree: a working directory of this repository, not
 * the main one, on the branch named after the change, holding the change's
 * `tasks.md`. It need not be active in the main checkout — a change usually
 * is not until its pull request merges. */
export async function resolveOwnWorktree(options: OwnWorktreeOptions): Promise<OwnWorktree | OwnWorktreeRefusal> {
  const { changeName } = options;
  if (!isValidChangeName(changeName)) return refuse("no-worktree", `"${changeName}" is not a change name.`);
  let worktrees;
  try {
    // Made inside the guard: `simple-git` refuses a directory that does not
    // exist as it is constructed, not when it is asked.
    const git = options.git ?? createGitWrapper({ cwd: options.repositoryRoot });
    worktrees = await git.worktreeList();
  } catch {
    // Not a git repository, or no git: there is then no worktree of the
    // change's own, which is a true statement rather than a failure.
    return refuse("no-worktree", `${changeName} has no worktree of its own: this is not a git repository git can list.`);
  }
  const own = worktrees.find((worktree, index) => changeOfWorktree(worktree, index === 0) === changeName);
  if (own === undefined || own.branch === undefined) {
    return refuse("no-worktree", `${changeName} has no worktree of its own, so nothing here acts on it.`);
  }
  const tasksPath = path.join(own.path, "openspec", "changes", changeName, "tasks.md");
  if (!(await exists(tasksPath))) {
    return refuse("no-task-list", `${changeName}'s worktree, ${own.path}, has no openspec/changes/${changeName}/tasks.md.`);
  }
  const mainBranch = worktrees[0]?.branch;
  return { ok: true, path: own.path, branch: own.branch, tasksPath, ...(mainBranch !== undefined ? { mainBranch } : {}) };
}

function pathKey(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function describeHolder(holder: WorkspaceLeaseConflict): string {
  return `a ${holder.hostKind} run on ${holder.hostname} (pid ${holder.pid})${holder.author !== undefined ? `, ${holder.author}'s` : ""}`;
}

export interface RunWorkingOptions {
  /** Test seams: the lease holder and the runs' records, in place of
   * reading them. */
  readLease?: (worktreePath: string) => Promise<WorkspaceLeaseConflict | undefined>;
  readStatuses?: () => Promise<AgentStatusReport[]>;
}

/** Who is working in the worktree, or `undefined`. A run holding its lease,
 * or a live record naming the change in that directory, may be editing the
 * very file a tick would write. */
async function runWorkingIn(
  worktree: OwnWorktree,
  options: OwnWorktreeOptions & RunWorkingOptions,
): Promise<string | undefined> {
  const holder = await (options.readLease ?? ((root: string) => readWorkspaceLeaseHolder(root)))(worktree.path);
  if (holder !== undefined) return describeHolder(holder);
  const statuses = await (options.readStatuses ?? (async () => {
    try {
      const directory = await resolveAgentStatusDirectory(createGitWrapper({ cwd: options.repositoryRoot }), options.repositoryRoot);
      return (await readAgentStatuses(directory)).reports;
    } catch {
      return [];
    }
  }))();
  const record = statuses.find((report) => !report.gone
    && report.changeName === options.changeName
    && pathKey(report.workingDirectory) === pathKey(worktree.path));
  return record === undefined ? undefined : `run ${record.instanceId}, which says "${record.activity}"`;
}

export interface SetTaskDoneOptions extends OwnWorktreeOptions, RunWorkingOptions {
  /** The task's line in `tasks.md`, counted from 0. */
  lineNumber: number;
  /** The task's text as it was shown. A line that no longer reads so is
   * not written: the list changed under the person. */
  expectedText: string;
  done: boolean;
  note?: string;
  /** Who is closing or reopening it, as the note says. Read from the
   * worktree's git identity where not given: a claim, never an identity. */
  by?: string;
  now?: () => Date;
}

export interface SetTaskDoneResult {
  ok: true;
  tasksPath: string;
  /** The line as written. */
  line: string;
  /** The note line written under the task, where there was a note. */
  noteLine?: string;
}

function localDate(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Ticks or unticks one task in the change's own worktree, with a note
 * under it. Changes the checkbox and nothing else on its line. */
export async function setTaskDone(options: SetTaskDoneOptions): Promise<SetTaskDoneResult | OwnWorktreeRefusal> {
  const worktree = await resolveOwnWorktree(options);
  if (!worktree.ok) return worktree;

  const working = await runWorkingIn(worktree, options);
  if (working !== undefined) {
    return refuse("run-working", `${options.changeName}'s worktree is being worked by ${working}; its task list is left alone until that run ends.`);
  }

  const raw = await readFile(worktree.tasksPath, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
  const line = lines[options.lineNumber];
  const match = line === undefined ? null : TASK_CHECKBOX_LINE_RE.exec(line);
  if (line === undefined || match === null) {
    return refuse("not-a-task", `Line ${options.lineNumber + 1} of ${options.changeName}'s tasks.md is not a task.`);
  }
  // Compared without the leading number: a card shows a task's number and
  // its text apart, and either is enough to say the line is the one shown.
  const withoutNumber = (text: string): string => text.trim().replace(/^\d+(?:\.\d+)*\.?\s*/u, "");
  if (withoutNumber(match[2] ?? "") !== withoutNumber(options.expectedText)) {
    return refuse("line-changed", `${options.changeName}'s tasks.md has changed since it was shown; read it again and try again.`);
  }

  const item = parseTaskChecklist(raw).find((candidate) => candidate.lineNumber === options.lineNumber) as TaskChecklistItem;
  const note = options.note?.trim() ?? "";
  if (options.done && note.length === 0 && (item.humanOnly === true || item.delegatedTo !== undefined)) {
    return refuse(
      "note-required",
      `${taskNumberOf(item.text) ?? "This task"} is ${item.humanOnly === true ? "Human-only" : `delegated to ${item.delegatedTo}`}: say what was checked, so the note can be written under it.`,
    );
  }

  const written = line.replace(/\[[ xX]\]/, options.done ? "[x]" : "[ ]");
  lines[options.lineNumber] = written;

  let noteLine: string | undefined;
  if (note.length > 0) {
    const by = options.by ?? (await createGitWrapper({ cwd: worktree.path }).configuredIdentity().catch(() => undefined)) ?? "a person";
    const when = localDate((options.now ?? (() => new Date()))());
    const indent = `${/^[ \t]*/.exec(line)?.[0] ?? ""}  `;
    noteLine = `${indent}${options.done ? "Closed" : "Reopened"} by ${by} on ${when}: ${note.replace(/\s+/g, " ")}`;
    // Under the lines that carry the item on, before any blank line: the
    // merge gate reads what continues an item, and a note after a blank
    // line would not count as written under it.
    let at = options.lineNumber + 1;
    while (at < lines.length && /^[ \t]+(?![-*+][ \t])\S/.test(lines[at] ?? "")) at += 1;
    lines.splice(at, 0, noteLine);
  }

  const temporary = `${worktree.tasksPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, lines.join(eol), "utf8");
    await rename(temporary, worktree.tasksPath);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
  return { ok: true, tasksPath: worktree.tasksPath, line: written, ...(noteLine !== undefined ? { noteLine } : {}) };
}

export interface CommitTaskListResult {
  ok: true;
  commit: string;
  branch: string;
  /** Where it was pushed: `<remote>/<branch>`. */
  pushedTo: string;
  message: string;
}

export interface CommitTaskListRefusal extends OwnWorktreeRefusal {
  /** The commit made before a push was refused, which stays. */
  commit?: string;
}

/** The commit's message from what changed in the task list: the numbers
 * ticked and reopened, which is what a log reader wants to know. */
export function taskListCommitMessage(changeName: string, diff: string): string {
  const ticked: string[] = [];
  const reopened: string[] = [];
  for (const line of diff.split(/\r?\n/)) {
    const added = /^\+[ \t]*-\s\[([ xX])\]\s*(\d+(?:\.\d+)*)/.exec(line);
    if (added === null) continue;
    ((added[1] ?? "").toLowerCase() === "x" ? ticked : reopened).push(added[2] ?? "");
  }
  const parts = [
    ...(ticked.length > 0 ? [`ticked ${ticked.join(", ")}`] : []),
    ...(reopened.length > 0 ? [`reopened ${reopened.join(", ")}`] : []),
  ];
  return `tasks(${changeName}): ${parts.length > 0 ? parts.join("; ") : "update the task list"}`;
}

function gitMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).trim();
}

/** Commits the change's `tasks.md` alone in its own worktree and pushes the
 * worktree's branch. Nothing else in the worktree is staged or committed. */
export async function commitTaskList(
  options: OwnWorktreeOptions,
): Promise<CommitTaskListResult | CommitTaskListRefusal> {
  const worktree = await resolveOwnWorktree(options);
  if (!worktree.ok) return worktree;
  const { branch } = worktree;
  if (branch === worktree.mainBranch || branch === "main" || branch === "master") {
    return refuse("default-branch", `${options.changeName}'s worktree is on ${branch}, the default branch; a task list is never committed there.`);
  }

  const git = openGit(worktree.path);
  const relative = path.relative(worktree.path, worktree.tasksPath).split(path.sep).join("/");
  const head = (await git.raw(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  if (head === "HEAD") return refuse("detached-head", `${options.changeName}'s worktree has no branch checked out.`);

  const diff = await git.raw(["diff", "HEAD", "--", relative]);
  if (diff.trim().length === 0) {
    return refuse("nothing-to-commit", `${options.changeName}'s tasks.md has nothing to commit.`);
  }
  const message = taskListCommitMessage(options.changeName, diff);
  // `--only` with the path: the commit holds this file, whatever else the
  // index holds, and leaves the rest of the index as it was.
  await git.raw(["commit", "--only", "-m", message, "--", relative]);
  const commit = (await git.raw(["rev-parse", "HEAD"])).trim();

  const upstreams = await createGitWrapper({ cwd: worktree.path }).branchUpstreams();
  const upstream = upstreams.find((entry) => entry.branch === branch)?.upstream;
  const remote = upstream !== undefined && upstream.includes("/") ? upstream.slice(0, upstream.indexOf("/")) : "origin";
  try {
    await git.raw(upstream !== undefined ? ["push", remote, branch] : ["push", "-u", remote, branch]);
  } catch (error) {
    return { ...refuse("push-rejected", `Committed ${commit.slice(0, 8)}, but the push was refused: ${gitMessage(error)}`), commit };
  }
  return { ok: true, commit, branch, pushedTo: `${remote}/${branch}`, message };
}

/** A change's task rows, for a page that shows them whole: from its own
 * worktree, where the card's controls act, or from this checkout's copy,
 * read-only, where it has no worktree of its own. */
export interface ChangeTaskRows {
  ok: true;
  changeName: string;
  /** Where they were read. `ownWorktree` is the only place anything is
   * offered. */
  source: "own-worktree" | "this-checkout";
  path: string;
  tasksPath: string;
  rows: TaskRowFacts[];
}

/** One task as the page shows it. The shape the survey's rows have, so a
 * card and the page render one task one way. */
export interface TaskRowFacts {
  number?: string;
  text: string;
  section?: string;
  lineNumber: number;
  body?: string;
  done: boolean;
  closedBy: "agent" | "person" | "named-agent";
  agent?: string;
}

function rowOf(item: TaskChecklistItem): TaskRowFacts {
  const number = taskNumberOf(item.text);
  return {
    ...(number !== undefined ? { number } : {}),
    text: number === undefined ? item.text.trim() : item.text.trim().replace(/^\d+(?:\.\d+)*\.?\s*/u, ""),
    ...(item.section !== undefined ? { section: item.section } : {}),
    lineNumber: item.lineNumber,
    ...(item.body !== undefined ? { body: item.body } : {}),
    done: item.done,
    ...(item.humanOnly === true
      ? { closedBy: "person" as const }
      : item.delegatedTo !== undefined
        ? { closedBy: "named-agent" as const, agent: item.delegatedTo }
        : { closedBy: "agent" as const }),
  };
}

export async function readChangeTaskRows(options: OwnWorktreeOptions): Promise<ChangeTaskRows | OwnWorktreeRefusal> {
  const own = await resolveOwnWorktree(options);
  if (own.ok) {
    return {
      ok: true,
      changeName: options.changeName,
      source: "own-worktree",
      path: own.path,
      tasksPath: own.tasksPath,
      rows: parseTaskChecklist(await readFile(own.tasksPath, "utf8")).map(rowOf),
    };
  }
  if (own.kind !== "no-worktree") return own;
  const here = path.join(path.resolve(options.repositoryRoot), "openspec", "changes", options.changeName, "tasks.md");
  if (!isValidChangeName(options.changeName) || !(await exists(here))) {
    return refuse("no-task-list", `${options.changeName} has no tasks.md here or in a worktree of its own.`);
  }
  return {
    ok: true,
    changeName: options.changeName,
    source: "this-checkout",
    path: path.resolve(options.repositoryRoot),
    tasksPath: here,
    rows: parseTaskChecklist(await readFile(here, "utf8")).map(rowOf),
  };
}

export interface OwnDelegatedRunOptions extends OwnWorktreeOptions, RunWorkingOptions {
  lineNumber: number;
  /** The runners for a working directory. A host builds them for the own
   * worktree as `openspec-ui-cli run --cwd` does, so the run's allowlist,
   * sandbox and audit are that directory's. */
  runnersFor: (workspaceRoot: string) => (agentId: string) => AgentRunner | undefined;
  auditLog?: AuditLog;
  onEvent?: (event: Event) => void;
}

/** Runs the agent a delegated task names, on that task, in the change's own
 * worktree: the same `runDelegatedItem` the inbox uses, pointed at the
 * worktree. */
export async function runOwnDelegatedItem(options: OwnDelegatedRunOptions): Promise<DelegatedItemRunResult | OwnWorktreeRefusal> {
  const worktree = await resolveOwnWorktree(options);
  if (!worktree.ok) return worktree;
  const working = await runWorkingIn(worktree, options);
  if (working !== undefined) {
    return refuse("run-working", `${options.changeName}'s worktree is being worked by ${working}; start this when that run ends.`);
  }
  return runDelegatedItem({
    workspaceRoot: worktree.path,
    changeName: options.changeName,
    lineNumber: options.lineNumber,
    resolveRunner: options.runnersFor(worktree.path),
    // The worktree's own log, where its runners record the run: a request
    // and its reply belong beside the run they were about.
    auditLog: options.auditLog ?? new FileAuditLog(auditLogPath(worktree.path)),
    ...(options.onEvent !== undefined ? { onEvent: options.onEvent } : {}),
  });
}

/** The line of task `<number>` in the change's own worktree, with its text,
 * for a caller that names a task by number (the terminal). */
export async function findOwnTask(
  options: OwnWorktreeOptions & { number: string },
): Promise<{ ok: true; item: TaskChecklistItem } | OwnWorktreeRefusal> {
  const worktree = await resolveOwnWorktree(options);
  if (!worktree.ok) return worktree;
  const item = parseTaskChecklist(await readFile(worktree.tasksPath, "utf8"))
    .find((candidate) => taskNumberOf(candidate.text) === options.number);
  return item === undefined
    ? refuse("not-a-task", `${options.changeName}'s tasks.md has no task ${options.number}.`)
    : { ok: true, item };
}
