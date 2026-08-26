// Best-effort, git-derived timestamps for a change and its tasks (see
// openspec/changes/add-change-timeline-data-layer/design.md). Every date
// degrades to `null`/`undefined` on any git failure — never throws — since
// this data is a nice-to-have visualization aid, not something the rest of
// a change read should ever depend on succeeding.

import { readFile } from "node:fs/promises";
import simpleGit from "simple-git";
import { readTaskChecklist, type TaskChecklistItem } from "./task-checklist.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";

export interface ChangeTimelineTask extends TaskChecklistItem {
  /** ISO 8601 date the task was last checked/unchecked, per git blame on
   * its tasks.md line — `null` when undeterminable (never checked, or
   * blame data unavailable). */
  date: string | null;
}

export interface ChangeTimelineSpec {
  specId: string;
  content: string;
}

export interface ChangeTimeline {
  changeName: string;
  archived: boolean;
  /** ISO 8601, best-effort (earliest commit that added proposal.md) — `null`
   * when undeterminable (shallow clone, proposal.md never committed). */
  createdDate: string | null;
  /** ISO 8601 date, parsed from the `YYYY-MM-DD-<name>` archive folder
   * name — `null` for an active (non-archived) change. */
  archivedDate: string | null;
  proposal: string;
  design: string;
  specs: ChangeTimelineSpec[];
  tasks: ChangeTimelineTask[];
}

const BLAME_HEADER_RE = /^([0-9a-f]{40}) \d+ (\d+)(?: \d+)?$/;
const AUTHOR_TIME_RE = /^author-time (\d+)$/;
const ARCHIVE_DATE_RE = /^(\d{4}-\d{2}-\d{2})-/;

/** Returns a `finalLineNumber (0-indexed) -> ISO date` map derived from
 * `git blame --line-porcelain`, or `undefined` if blame itself fails
 * (shallow clone, untracked file, not a git repository). The porcelain
 * format gives full metadata (including `author-time`) only the first
 * time a given commit appears in the output; later lines from the same
 * commit are abbreviated, so `author-time` is tracked per commit sha and
 * reused for those repeats. */
export async function blameLineDates(
  cwd: string,
  filePath: string,
): Promise<Map<number, string> | undefined> {
  let output: string;
  try {
    output = await simpleGit(cwd).raw(["blame", "--line-porcelain", "--", filePath]);
  } catch {
    return undefined;
  }

  const dates = new Map<number, string>();
  const authorTimeBySha = new Map<string, number>();
  let currentSha: string | undefined;
  let currentFinalLine: number | undefined;

  for (const line of output.split("\n")) {
    const header = line.match(BLAME_HEADER_RE);
    if (header) {
      currentSha = header[1];
      currentFinalLine = Number(header[2]);
      continue;
    }
    if (line.startsWith("\t")) {
      if (currentSha !== undefined && currentFinalLine !== undefined) {
        const authorTime = authorTimeBySha.get(currentSha);
        if (authorTime !== undefined) {
          dates.set(currentFinalLine - 1, new Date(authorTime * 1000).toISOString());
        }
      }
      currentSha = undefined;
      currentFinalLine = undefined;
      continue;
    }
    const authorTimeMatch = line.match(AUTHOR_TIME_RE);
    if (authorTimeMatch && currentSha !== undefined) {
      authorTimeBySha.set(currentSha, Number(authorTimeMatch[1]));
    }
  }

  return dates;
}

/** ISO 8601 (UTC, `Z`-suffixed — same representation `blameLineDates`
 * uses, so every date on a `ChangeTimeline` sorts/compares consistently)
 * timestamp of the earliest commit that added `filePath`, or `null` if
 * undeterminable. */
export async function getFileCreatedDate(cwd: string, filePath: string): Promise<string | null> {
  try {
    const output = await simpleGit(cwd).raw([
      "log",
      "--follow",
      "--diff-filter=A",
      "--format=%aI",
      "--reverse",
      "--",
      filePath,
    ]);
    const firstLine = output.split("\n").map((line) => line.trim()).find((line) => line.length > 0);
    return firstLine ? new Date(firstLine).toISOString() : null;
  } catch {
    return null;
  }
}

/** Parses the `YYYY-MM-DD-` prefix `openspec archive` adds to an archived
 * change's folder name — no git call, and reliable regardless of
 * squash-merge history. `null` for an active change. */
export function getChangeArchivedDate(changeName: string, archived: boolean): string | null {
  if (!archived) return null;
  return changeName.match(ARCHIVE_DATE_RE)?.[1] ?? null;
}

export async function getChangeTimeline(
  workspaceRoot: string,
  changeName: string,
  archived: boolean,
): Promise<ChangeTimeline> {
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  const change = (archived ? workspace.archivedChanges : workspace.changes).find(
    (c) => c.name === changeName,
  );

  const proposalArtifact = change?.artifacts.find((a) => a.id === "proposal");
  const designArtifact = change?.artifacts.find((a) => a.id === "design");
  const specArtifacts = change?.artifacts.filter((a) => a.kind === "delta-spec") ?? [];

  const [proposal, design, specs, taskItems, createdDate, blameDates] = await Promise.all([
    readIfExists(proposalArtifact),
    readIfExists(designArtifact),
    Promise.all(
      specArtifacts.map(async (artifact): Promise<ChangeTimelineSpec> => ({
        specId: artifact.label,
        content: await readIfExists(artifact),
      })),
    ),
    readTaskChecklist(workspaceRoot, changeName, archived),
    proposalArtifact?.exists
      ? getFileCreatedDate(workspaceRoot, proposalArtifact.path)
      : Promise.resolve(null),
    (async () => {
      const tasksArtifact = change?.artifacts.find((a) => a.id === "tasks");
      return tasksArtifact?.exists ? blameLineDates(workspaceRoot, tasksArtifact.path) : undefined;
    })(),
  ]);

  // blame reports when a line was last touched, which for a still-unchecked
  // task is just its creation/last-edit date, not a completion date — that
  // would misleadingly look like "done on this date" in the UI, so only a
  // checked task's date is ever surfaced (see design.md).
  const tasks: ChangeTimelineTask[] = taskItems.map((task) => ({
    ...task,
    date: task.done ? blameDates?.get(task.lineNumber) ?? null : null,
  }));

  return {
    changeName,
    archived,
    createdDate,
    archivedDate: getChangeArchivedDate(changeName, archived),
    proposal,
    design,
    specs,
    tasks,
  };
}

async function readIfExists(artifact: { path: string; exists: boolean } | undefined): Promise<string> {
  if (!artifact?.exists) return "";
  return readFile(artifact.path, "utf8");
}

export interface ChangeTimelineRequestEntry {
  changeName: string;
  archived: boolean;
}

export async function getChangeTimelines(
  workspaceRoot: string,
  entries: ChangeTimelineRequestEntry[],
): Promise<ChangeTimeline[]> {
  return Promise.all(
    entries.map((entry) => getChangeTimeline(workspaceRoot, entry.changeName, entry.archived)),
  );
}
