// Reads the dated facts of a change and plays them into its stages
// (ADR 0037 decisions 5 and 6, a-change-knows-its-stage).
//
// Every fact comes from a source that already exists and says so:
// - a commit (`proposal.md` added, `tasks.md` added);
// - `git blame` of each closed task line;
// - the audit log's runs;
// - the forge's pull request times;
// - commits on the change's branch;
// - the change's history.
//
// Nothing is guessed: a source that cannot be read gives no fact, and the
// stage then comes from what is left.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { runTimestampsByChange } from "./audit-runs.js";
import { readChangeHistory, type ChangeHistory } from "./change-history.js";
import type { ChangeRoles, ChangeStage } from "./change-history-facts.js";
import type { ChangeStanding } from "./change-standing-facts.js";
import { playStages, stageFromFiles, totalsOf, type ChangeStageSummary, type StageFact, type StageTotal, type StageVisit } from "./change-stage-facts.js";
import { blameLineDates, getFileCreatedDate } from "./change-timeline.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import { readRepositoryAuditEntries } from "./repository-audit.js";
import { parseTaskChecklist } from "./task-checklist.js";

const CHANGES = "openspec/changes";

export interface ChangeStageReading {
  changeName: string;
  /** Where the change is now. */
  stage: ChangeStage;
  /** Since when, where a fact dates it. */
  since?: string;
  visits: StageVisit[];
  totals: StageTotal[];
  roles: ChangeRoles;
}

export interface ChangeStageOptions {
  /** What the standings read about this change: its branch and its pull
   * request, with the forge's times. */
  standing?: ChangeStanding;
  /** When the audit log says runs of this change happened. */
  runTimes?: readonly string[];
  history?: ChangeHistory;
  git?: Pick<GitWrapper, "commitTimesBetween">;
  remote?: string;
  defaultBranch?: string;
  now?: () => Date;
}

/** The facts that date a change's stages, oldest first. */
export async function readStageFacts(root: string, changeName: string, options: ChangeStageOptions = {}): Promise<StageFact[]> {
  const facts: StageFact[] = [];
  const directory = `${CHANGES}/${changeName}`;

  const proposed = await getFileCreatedDate(root, `${directory}/proposal.md`);
  if (proposed !== null) facts.push({ stage: "proposed", at: proposed, source: "git-commit", what: "proposal.md committed" });
  const planned = await getFileCreatedDate(root, `${directory}/tasks.md`);
  if (planned !== null) facts.push({ stage: "planned", at: planned, source: "git-commit", what: "tasks.md committed" });

  // Each closed task line, dated by the commit that last touched it: the
  // tick, or the edit after it.
  const tasksText = await readFile(path.join(root, directory, "tasks.md"), "utf8").catch(() => undefined);
  if (tasksText !== undefined) {
    const blamed = await blameLineDates(root, `${directory}/tasks.md`);
    for (const item of parseTaskChecklist(tasksText)) {
      const at = item.done ? blamed?.get(item.lineNumber) : undefined;
      if (at !== undefined) facts.push({ stage: "in-progress", at, source: "git-blame", what: `closed ${item.text.split(/\s/u)[0] ?? "a task"}` });
    }
  }
  for (const at of options.runTimes ?? []) facts.push({ stage: "in-progress", at, source: "audit-log", what: "a run" });

  const pullRequest = options.standing?.pullRequest;
  if (pullRequest?.createdAt !== undefined) facts.push({ stage: "in-review", at: pullRequest.createdAt, source: "forge", what: `#${pullRequest.number} opened` });
  if (pullRequest?.mergedAt !== undefined) facts.push({ stage: "landed", at: pullRequest.mergedAt, source: "forge", what: `#${pullRequest.number} merged` });

  // A commit on the change's branch is work; pushed while its pull request
  // is open, it is a new version for review.
  const branch = options.standing?.branch;
  if (branch !== undefined && (branch.remote || branch.local)) {
    const remote = options.remote ?? "origin";
    const base = `${remote}/${options.defaultBranch ?? "main"}`;
    const ref = branch.remote ? `${remote}/${branch.name}` : branch.name;
    const git = options.git ?? createGitWrapper({ cwd: root });
    const opened = pullRequest?.createdAt === undefined ? Number.NaN : Date.parse(pullRequest.createdAt);
    const merged = pullRequest?.mergedAt === undefined ? Number.POSITIVE_INFINITY : Date.parse(pullRequest.mergedAt);
    for (const at of await git.commitTimesBetween(base, ref)) {
      const time = Date.parse(at);
      const inReview = !Number.isNaN(opened) && time >= opened && time < merged;
      facts.push({ stage: inReview ? "in-review" : "in-progress", at, source: "git-commit", what: inReview ? "pushed for review" : "a commit on its branch" });
    }
  }

  for (const entry of options.history?.entries ?? []) {
    const event = entry.event;
    if (event?.type !== "sent-back") continue;
    if (options.history?.problems.some((problem) => problem.file === entry.file)) continue;
    facts.push({ stage: event.toStage, at: event.at, source: "history", what: `${event.by.handle}: ${event.reason}`, back: true });
  }
  // git, blame, the audit log and the forge each write a time their own way
  // (`Z`, `+00:00`, with or without milliseconds): said once, in UTC.
  return facts
    .filter((fact) => !Number.isNaN(Date.parse(fact.at)))
    .map((fact) => ({ ...fact, at: new Date(fact.at).toISOString() }));
}

/** Where one change is, and every stay in every stage. */
export async function readChangeStage(root: string, changeName: string, options: ChangeStageOptions = {}): Promise<ChangeStageReading> {
  const now = (options.now ?? (() => new Date()))();
  const history = options.history ?? await readChangeHistory(root, changeName);
  const facts = await readStageFacts(root, changeName, { ...options, history });
  const visits = playStages(facts);
  let stage: ChangeStage;
  if (visits.length > 0) {
    stage = (visits.at(-1) as StageVisit).stage;
  } else {
    const tasks = parseTaskChecklist(await readFile(path.join(root, CHANGES, changeName, "tasks.md"), "utf8").catch(() => ""));
    stage = stageFromFiles({ total: tasks.length, done: tasks.filter((item) => item.done).length });
  }
  // A merge the forge reports without a time still lands the change.
  if (options.standing?.pullRequest?.state === "MERGED" && stage !== "landed" && stage !== "archived") stage = "landed";
  const current = visits.at(-1);
  return {
    changeName,
    stage,
    ...(current !== undefined && current.stage === stage ? { since: current.from } : {}),
    visits,
    totals: totalsOf(visits, now),
    roles: history.roles,
  };
}

/** One reading, as a surface needs it: without the visits, which only a
 * change's own history view draws. */
export function summariseStage(reading: ChangeStageReading): ChangeStageSummary {
  return {
    changeName: reading.changeName,
    stage: reading.stage,
    ...(reading.since !== undefined ? { since: reading.since } : {}),
    roles: reading.roles,
    totals: reading.totals,
  };
}

/** Every active change of a working tree, where it is and how long it spent
 * in each stage. The standings and the audit log are read once for all. */
export async function readChangeStages(root: string, options: { standings?: readonly ChangeStanding[]; now?: () => Date } = {}): Promise<ChangeStageReading[]> {
  const names: string[] = [];
  for (const name of await readdir(path.join(root, CHANGES)).catch(() => [] as string[])) {
    if (name === "archive") continue;
    const proposal = await readFile(path.join(root, CHANGES, name, "proposal.md"), "utf8").catch(() => undefined);
    if (proposal !== undefined) names.push(name);
  }
  const git = createGitWrapper({ cwd: root });
  const audit = await readRepositoryAuditEntries({ git, workspaceRoot: root }).catch(() => []);
  const runs = runTimestampsByChange(audit);
  const readings: ChangeStageReading[] = [];
  for (const name of names.sort()) {
    const standing = options.standings?.find((one) => one.changeName === name);
    readings.push(await readChangeStage(root, name, {
      ...(standing !== undefined ? { standing } : {}),
      runTimes: runs.get(name) ?? [],
      git,
      ...(options.now !== undefined ? { now: options.now } : {}),
    }));
  }
  return readings;
}
