// What "behind" is, and how it is said (main-catches-up-with-what-landed).
//
// Pure: no git, no filesystem, so both hosts' views can carry the shape
// and the wording without the node side of core coming with them. The
// reading itself is `main-drift.ts`.

/** The branch a checkout is expected to sit on, and the remote it follows.
 *
 * Hard-coded to match `change-standing.ts`, which reads the archive on
 * `main` at `origin` to say "Archived on main". Two readings that disagree
 * about which branch is the default would be worse than one that names it
 * in one place. */
export const DEFAULT_BRANCH = "main";
export const DEFAULT_REMOTE = "origin";

export interface MainDrift {
  /** The branch this checkout is on, which may not be the default one. */
  branch: string;
  defaultBranch: string;
  remote: string;
  /** Commits the branch has that its remote does not, and the other way
   * round. `behind` is what a person is told; `ahead` is what makes a
   * fast-forward impossible. */
  ahead: number;
  behind: number;
  /** When refs were last fetched, so a stale count reads as stale. */
  fetchedAt?: string;
  /** The visible changes the default branch already carries archived. */
  archivedOnDefault: string[];
  /** Whether the tree is clean. Read with the rest because it is the
   * first thing that would refuse a catch-up, and a press that is going
   * to be refused should be able to say so before it is pressed. */
  clean: boolean;
}

export type CatchUpResult =
  | { ok: true; branch: string; moved: number }
  | { ok: false; why: string };

/** What the drift line says.
 *
 * The two facts explain each other: a wall of cards for changes that are
 * already over is what being behind looks like. */
export function driftWords(drift: MainDrift): string {
  const commits = `${drift.behind} ${drift.behind === 1 ? "commit" : "commits"}`;
  const archived = drift.archivedOnDefault.length;
  const alsoArchived = archived === 0
    ? ""
    : `; ${archived} of these ${archived === 1 ? "changes is" : "changes are"} archived on ${drift.defaultBranch}`;
  return `${drift.defaultBranch} is ${commits} behind ${drift.remote}/${drift.defaultBranch}${alsoArchived}`;
}
