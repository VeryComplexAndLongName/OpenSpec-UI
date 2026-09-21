// How far this checkout is behind what has landed, and the one command
// that closes the gap (main-catches-up-with-what-landed).
//
// Agents work in other working directories and their pull requests merge.
// The window a person watches from sits on a `main` that is behind by
// however many landed while they were looking, and nothing says so: on
// 2026-09-19 the owner's checkout was seventeen commits behind, and the
// Pipeline looked like a wall of changes that were already archived.
//
// Nothing here fetches. The standings already fetch at most once per
// interval (`change-standing.ts`); this reads the refs that fetch left and
// says how old they are, so a stale number reads as stale.

import { createGitWrapper, type GitWrapper } from "./git.js";
import type { ChangeStandings } from "./change-standing.js";
import { DEFAULT_BRANCH, DEFAULT_REMOTE, type CatchUpResult, type MainDrift } from "./main-drift-facts.js";

export {
  DEFAULT_BRANCH,
  DEFAULT_REMOTE,
  driftWords,
  type CatchUpResult,
  type MainDrift,
} from "./main-drift-facts.js";

export interface ReadMainDriftOptions {
  root: string;
  /** The standings this host already read, where it has them: the list of
   * changes archived on the default branch comes from there rather than
   * from a second walk of the archive. */
  standings?: ChangeStandings;
  git?: Pick<GitWrapper, "currentBranch" | "aheadBehind" | "lastFetchedAt" | "status"> & Partial<Pick<GitWrapper, "listTreeNames">>;
}

const CHANGES = "openspec/changes";

/** The changes under way on `theirs` that `ours` does not hold. */
async function landedNotHere(git: Partial<Pick<GitWrapper, "listTreeNames">>, ours: string, theirs: string): Promise<string[]> {
  if (git.listTreeNames === undefined) return [];
  try {
    const here = new Set(await git.listTreeNames(ours, CHANGES));
    // Archived here already, under its dated folder, counts as held.
    for (const archived of await git.listTreeNames(ours, `${CHANGES}/archive`)) here.add(archived.replace(/^[0-9]{4}-[0-9]{2}-[0-9]{2}-/u, ""));
    return (await git.listTreeNames(theirs, CHANGES))
      .filter((name) => name !== "archive" && !here.has(name))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

/** What this checkout's default branch is missing, or `undefined` where
 * the repository cannot answer - no branch, no remote ref, no git. */
export async function readMainDrift(options: ReadMainDriftOptions): Promise<MainDrift | undefined> {
  const git = options.git ?? createGitWrapper({ cwd: options.root });
  let branch: string;
  try {
    branch = (await git.currentBranch()).trim();
  } catch {
    return undefined;
  }
  if (branch.length === 0) return undefined;

  const counts = await git.aheadBehind(DEFAULT_BRANCH, `${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`);
  if (counts === undefined) return undefined;

  const fetchedAt = await git.lastFetchedAt().catch(() => undefined);
  let clean = false;
  try {
    clean = (await git.status()).isClean;
  } catch {
    // Unreadable is not clean: a catch-up is refused rather than risked.
  }

  const archivedOnDefault = (options.standings?.standings ?? [])
    .filter((standing) => standing.main?.kind === "archived")
    .map((standing) => standing.changeName)
    .sort((left, right) => left.localeCompare(right));

  const notHere = counts.behind > 0
    ? await landedNotHere(git, DEFAULT_BRANCH, `${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`)
    : [];

  return {
    branch,
    defaultBranch: DEFAULT_BRANCH,
    remote: DEFAULT_REMOTE,
    ahead: counts.ahead,
    behind: counts.behind,
    ...(notHere.length > 0 ? { landedNotHere: notHere } : {}),
    ...(fetchedAt !== undefined ? { fetchedAt: fetchedAt.toISOString() } : {}),
    archivedOnDefault,
    clean,
  };
}

export interface CatchUpOptions {
  root: string;
  git?: Pick<GitWrapper, "currentBranch" | "aheadBehind" | "status" | "fastForward">;
}

/** Brings the checkout's default branch up to its remote, by fast-forward
 * alone.
 *
 * Refuses three ways, each by name, before git is asked to move anything.
 * `--ff-only` would refuse the second case itself, but with its own words:
 * a person reading "your branch has 2 commits origin/main does not" knows
 * what to do, and a person reading git's refusal has to work it out. */
export async function catchUpWithMain(options: CatchUpOptions): Promise<CatchUpResult> {
  const git = options.git ?? createGitWrapper({ cwd: options.root });
  let branch: string;
  try {
    branch = (await git.currentBranch()).trim();
  } catch (error) {
    return { ok: false, why: `this checkout's branch could not be read: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (branch !== DEFAULT_BRANCH) {
    return { ok: false, why: `this checkout is on ${branch}, not ${DEFAULT_BRANCH}; catching up moves ${DEFAULT_BRANCH} and nothing else` };
  }

  let clean = false;
  try {
    clean = (await git.status()).isClean;
  } catch (error) {
    return { ok: false, why: `the working tree could not be read: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!clean) {
    return { ok: false, why: "the working tree is not clean; commit or stash first, so nothing of yours is moved over" };
  }

  const counts = await git.aheadBehind(DEFAULT_BRANCH, `${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`);
  if (counts === undefined) {
    return { ok: false, why: `${DEFAULT_REMOTE}/${DEFAULT_BRANCH} could not be read; fetch first` };
  }
  if (counts.ahead > 0) {
    return {
      ok: false,
      why: `${DEFAULT_BRANCH} has ${counts.ahead} commit${counts.ahead === 1 ? "" : "s"} ${DEFAULT_REMOTE}/${DEFAULT_BRANCH} does not; this only fast-forwards`,
    };
  }
  if (counts.behind === 0) return { ok: true, branch, moved: 0 };

  const moved = await git.fastForward(`${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`);
  if (!moved.ok) return { ok: false, why: moved.reason };
  return { ok: true, branch, moved: counts.behind };
}
