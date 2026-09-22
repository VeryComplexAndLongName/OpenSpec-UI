// Where a change stands across the repository, as facts with their sources
// — ADR 0026's amendment of 2026-09-13, "where a change stands, wherever it
// is".
//
// A leaf with no imports, so the browser can have it. `change-standing.ts`
// reads the repository to fill it in, and `change-state-word.ts` turns it
// into the one word every surface shows.

/** Ticked and total checklist items of one copy of a change. */
export interface TaskCounts {
  done: number;
  total: number;
}

/** A run a status record says is on a change, in one working directory. */
export interface StandingRun {
  instanceId: string;
  stage: string | null;
  /** The run waits on a person rather than working. */
  waiting: boolean;
}

/** One working directory's copy of a change. */
export interface StandingCopy {
  /** The directory's label. */
  label: string;
  path: string;
  branch?: string;
  /** Absent where the copy's task list could not be read. */
  counts?: TaskCounts;
  /** Live runs whose records name this change here. */
  runs: StandingRun[];
}

/** The change on the main ref. */
export type StandingOnMain =
  | { kind: "active"; counts?: TaskCounts }
  | { kind: "archived"; archiveName: string }
  /** The merge base of the main ref and this checkout had the change, and
   * the main ref no longer has it, active or archived. */
  | { kind: "deleted" }
  /** The main ref does not have the change, and never had it as far as the
   * merge base shows. */
  | { kind: "absent" };

/** The change's own branch, named after it (ADR 0022). */
export interface StandingBranch {
  name: string;
  local: boolean;
  remote: boolean;
  /** Where the branch carries the change's task list. */
  counts?: TaskCounts;
}

export interface StandingPullRequest {
  number: number;
  state: "OPEN" | "CLOSED" | "MERGED";
  /** When it was opened and when it merged, where the forge said. */
  createdAt?: string;
  mergedAt?: string;
}

/** Everything read about one change, each fact from a named source. */
export interface ChangeStanding {
  changeName: string;
  /** This checkout's copy. Absent where this checkout does not have it. */
  here?: StandingCopy;
  /** Every other working directory's copy. */
  elsewhere: StandingCopy[];
  /** Absent where no main ref could be read. */
  main?: StandingOnMain;
  /** Absent where the change has no branch of its own, local or remote. */
  branch?: StandingBranch;
  /** Absent where there is none, or pull requests could not be read. */
  pullRequest?: StandingPullRequest;
}

/** How fresh the sources were, and which could not be read. */
export interface StandingSources {
  /** The ref read as main: the remote's `main` where it exists, else the
   * local `main`. */
  mainRef?: string;
  /** When refs were last fetched, as an ISO timestamp. */
  lastFetchedAt?: string;
  /** Whether this reading fetched, and why that failed where it did. */
  fetch: { attempted: false } | { attempted: true; at: string; failed?: string };
  pullRequests: { read: true } | { read: false; why: string };
  /** Why refs could not be read at all, where they could not. The copies in
   * working directories still stand. */
  refsUnreadable?: string;
}

export interface ChangeStandings {
  readAt: string;
  standings: ChangeStanding[];
  sources: StandingSources;
}

const TASK_CHECKBOX_RE = /^[ \t]*-\s\[( |x|X)\]/gmu;

/** The checklist counts of a `tasks.md` text, as read from a ref. */
export function countTaskCheckboxes(tasksMarkdown: string): TaskCounts {
  let done = 0;
  let total = 0;
  for (const match of tasksMarkdown.matchAll(TASK_CHECKBOX_RE)) {
    total += 1;
    if (match[1]?.toLowerCase() === "x") done += 1;
  }
  return { done, total };
}

function minute(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

/** The sources line every surface shows beneath its list of changes. */
export function describeStandingSources(sources: StandingSources): string {
  const parts: string[] = [];
  if (sources.refsUnreadable !== undefined) {
    parts.push(`Refs could not be read: ${sources.refsUnreadable}.`);
  } else {
    parts.push(sources.mainRef !== undefined ? `Main read from ${sources.mainRef}.` : "No main branch was found.");
  }
  parts.push(sources.lastFetchedAt !== undefined
    ? `Refs last fetched ${minute(sources.lastFetchedAt)} UTC.`
    : "Refs have never been fetched here.");
  if (sources.fetch.attempted && sources.fetch.failed !== undefined) {
    parts.push(`The fetch at ${minute(sources.fetch.at)} UTC failed: ${sources.fetch.failed}.`);
  }
  if (!sources.pullRequests.read) parts.push(`Pull requests were not read: ${sources.pullRequests.why}.`);
  return parts.join(" ");
}
