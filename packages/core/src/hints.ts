// What the repository already knows, offered as something to act on —
// a-hint-says-what-can-run-together.
//
// `readChangeReadiness` computes which changes can be started alongside
// each other, which has nowhere of its own to run, and what any two
// would collide over. All of it is printed, and none of it is offered:
// a person reads the report and works out what to do with it.
//
// A leaf module, like `change-readiness-facts.ts` beside it: a pure
// function of the report, with only type imports, so the browser, the
// extension host and the terminal all derive the same suggestions from
// the same code rather than three surfaces inventing their own.
//
// What this deliberately does not do:
//
// - It writes nothing, starts nothing, and creates nothing. Each hint
//   carries the commands a person would run; running them is theirs.
// - It names no single plan. `readChangeReadiness` is pairwise on
//   purpose — "three changes where A and B collide and C collides with
//   neither have no single correct grouping, and presenting one would
//   choose for the reader and hide that a choice existed" — so this
//   names every maximal set, or beyond a limit, none with their count.
// - It has no clock, no timer and no background anything. It is called
//   where the report is built.

import type { ChangeReadiness, ChangeReadinessReport } from "./change-readiness-facts.js";

export type HintKind = "can-run-together" | "needs-a-worktree" | "held-by-a-finished-run" | "too-many-sets";

export interface Hint {
  /** Stable for the same facts, so a surface can key on it and a script
   * can act on one without matching prose. */
  id: string;
  kind: HintKind;
  /** What the hint is about, in the reader's vocabulary. */
  subject: string;
  /** The fact it was derived from. A suggestion whose reason is printed
   * can be checked in one step; one without a reason becomes folklore
   * the first time it is wrong. */
  because: string;
  /** Lines a person can paste. A suggestion without them leaves the
   * reader to translate advice into action, which is the work it was
   * supposed to save. */
  commands: string[];
}

export interface HintOptions {
  /** Above this many maximal sets, the sets are not named — see
   * `too-many-sets`. Five by default: a list long enough to need
   * reading is not a suggestion. */
  maxSets?: number;
  /** How long a lease may go unrenewed before its holder is treated as
   * gone. Passed in rather than read here so this stays a pure function
   * of the report it is given. */
  staleAfterMs?: number;
}

const DEFAULT_MAX_SETS = 5;

/** Every maximal set of changes that collide with none of each other.
 *
 * Maximal, not maximum: a set nobody else can join. Three changes where
 * A and B collide and C collides with neither produce {A, C} and
 * {B, C} — both named, so the reader can see that there was a choice.
 * Bron-Kerbosch without pivoting; the graph here is the handful of
 * changes a repository has active at once. */
function maximalSets(ready: readonly ChangeReadiness[]): string[][] {
  const names = ready.map((change) => change.changeName);
  const joins = new Map(ready.map((change) => [change.changeName, new Set(change.canJoin)]));

  const sets: string[][] = [];
  const expand = (current: string[], candidates: string[], excluded: string[]): void => {
    if (candidates.length === 0 && excluded.length === 0) {
      if (current.length > 1) sets.push([...current].sort());
      return;
    }
    const remaining = [...candidates];
    for (const candidate of remaining) {
      const neighbours = joins.get(candidate) ?? new Set<string>();
      expand(
        [...current, candidate],
        candidates.filter((name) => name !== candidate && neighbours.has(name)),
        excluded.filter((name) => neighbours.has(name)),
      );
      candidates = candidates.filter((name) => name !== candidate);
      excluded = [...excluded, candidate];
    }
  };
  expand([], names, []);

  // Deterministic: the same facts produce the same list in the same
  // order, so a surface keyed on `id` does not reshuffle between reads.
  //
  // `|` as the separator because a change name cannot contain one, so
  // two different sets cannot collapse into the same key. It was a NUL
  // first — unnecessary, and the one character
  // `scripts/check-source-text.mjs` exists to keep out of this
  // repository's sources, which is how this was caught.
  return sets
    .map((set) => set.join("|"))
    .filter((key, index, all) => all.indexOf(key) === index)
    .map((key) => key.split("|"))
    .sort((left, right) => right.length - left.length || left.join(",").localeCompare(right.join(",")));
}

function runTogether(sets: string[][], options: HintOptions): Hint[] {
  const limit = options.maxSets ?? DEFAULT_MAX_SETS;
  if (sets.length === 0) return [];
  if (sets.length > limit) {
    // Named none rather than the first few: a truncated list reads as a
    // recommendation, which is the one thing this must not produce.
    return [{
      id: "too-many-sets",
      kind: "too-many-sets",
      subject: `${sets.length} sets of changes could run together`,
      because: "More than one grouping is possible, and which one to take depends on what you want finished first.",
      commands: ["openspec-ui-cli ready"],
    }];
  }
  return sets.map((set) => ({
    id: `can-run-together:${set.join("+")}`,
    kind: "can-run-together" as const,
    subject: `${nameSome(set)} can run at the same time`,
    because: "Each is ready, each has a working directory of its own, and no two of them"
      + " declare a blocker, share a spec capability, or have changed the same file.",
    commands: set.map((changeName) => `openspec-ui-cli run ${changeName} --cwd <${changeName}'s worktree>`),
  }));
}

/** Names a set in a line a person reads rather than scrolls past.
 *
 * Beyond a few, the names are counted instead of listed. Twelve joined
 * by "and" is a run-on sentence, and the module's own rule — "a list
 * long enough to need reading is not a suggestion" — applies to the
 * width of one set as much as to the number of them. The commands below
 * still name every change: those are the work, and the reader needs all
 * of them. This is the headline. */
const NAMED_IN_A_SUBJECT = 3;

function nameSome(set: string[]): string {
  if (set.length <= NAMED_IN_A_SUBJECT + 1) {
    return set.length === 1
      ? (set[0] as string)
      : `${set.slice(0, -1).join(", ")} and ${set[set.length - 1] as string}`;
  }
  const rest = set.length - NAMED_IN_A_SUBJECT;
  return `${set.slice(0, NAMED_IN_A_SUBJECT).join(", ")} and ${rest} more`;
}

export function buildHints(report: ChangeReadinessReport, options: HintOptions = {}): Hint[] {
  const hints: Hint[] = [];
  const ready = report.changes.filter((change) => change.run.state === "ready");

  hints.push(...runTogether(maximalSets(ready), options));

  for (const change of ready) {
    if (!change.needsWorktree) continue;
    hints.push({
      id: `needs-a-worktree:${change.changeName}`,
      kind: "needs-a-worktree",
      subject: `${change.changeName} is ready and has nowhere to run`,
      because: "One workspace permits one mutating run, so a change without a working directory"
        + " of its own cannot be started beside anything.",
      commands: [change.needsWorktree],
    });
  }

  for (const change of report.changes) {
    if (change.run.state !== "running") continue;
    const { holder, worktreePath } = change.run;
    const staleAfterMs = options.staleAfterMs;
    // Whether a holder is gone is core's decision, made in
    // `releaseWorkspaceLease`; this only reports what the report it was
    // given already says about the heartbeat. It checks no process.
    if (staleAfterMs === undefined || holder.heartbeatAgeMs < staleAfterMs) continue;
    hints.push({
      id: `held-by-a-finished-run:${change.changeName}`,
      kind: "held-by-a-finished-run",
      subject: `${change.changeName}'s workspace is held by a run that stopped reporting itself`,
      because: `Its holder (${holder.hostname}, pid ${holder.pid}) last reported itself`
        + ` ${Math.round(holder.heartbeatAgeMs / 1000)}s ago.`,
      commands: [`openspec-ui-cli lease release --cwd ${worktreePath}`],
    });
  }

  return hints;
}
