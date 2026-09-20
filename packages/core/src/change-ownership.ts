// Whose change this is (changes-shows-one-change-and-who-owns-it).
//
// A working directory is cut from the default branch, so it holds every
// change that was active there - not one. On 2026-09-20 a fresh directory
// showed three active changes, all drawn alike, all with the full menu,
// and no way to tell which of them was its own business.
//
// The facts were already read: `surveyWorktrees` knows which directory is
// a change's worktree (ADR 0022) and which agent reports from it. This
// turns them into the one answer every surface needs, and the sentence to
// show it with, so that the tree and the standalone list cannot word the
// same answer differently.

import type { SurveyedDirectory, WorktreeSurvey } from "./worktree-survey-facts.js";

/** Where a change is worked, and by whom. */
export type ChangeOwnership =
  /** This working directory is the change's own worktree. */
  | { kind: "here" }
  /** Another working directory is, and its records check out. */
  | { kind: "elsewhere"; label: string; path: string; branch?: string; person?: string }
  /** Another working directory is, and a record reporting from it does not
   * check out. Named without a person: a record that fails its signature
   * is evidence of nothing, and naming whom it claims to be would be
   * worse than naming nobody. */
  | { kind: "unverified"; label: string; path: string; branch?: string }
  /** No working directory has taken it up. Anybody may. */
  | { kind: "nobody" };

/** The person a directory's live records name, where they agree on one and
 * every one of them checks out. A directory whose records disagree is
 * named without a person rather than by the first of them. */
function personOf(directory: SurveyedDirectory): { person?: string; unverified: boolean } {
  const live = directory.runs.filter((run) => !run.gone);
  if (live.some((run) => run.signature === "does-not-check-out")) return { unverified: true };
  const labels = new Set(
    live.filter((run) => run.signature === "verified" && run.person !== undefined)
      .map((run) => (run.person as { label: string }).label),
  );
  const only = labels.size === 1 ? [...labels][0] as string : undefined;
  return { unverified: false, ...(only !== undefined ? { person: only } : {}) };
}

/** The directory that is working the named change.
 *
 * `belongsTo` is the survey's own pairing, and it holds only while the
 * change is active in the main working directory - the rule ADR 0029
 * needs, so that one change is one card. A change proposed this morning
 * is not on `main` yet, so its own directory would read as nobody's on the
 * very morning the question matters most; a live look at this repository
 * on 2026-09-20 showed exactly that.
 *
 * So a directory also works a change when its branch bears that change's
 * name and the change is present in that directory. The pairing rule is
 * unchanged for everybody else: this reads more, and decides nothing the
 * cards decide. */
function directoryWorking(changeName: string, survey: WorktreeSurvey | undefined): SurveyedDirectory | undefined {
  const paired = survey?.directories.find((directory) => directory.belongsTo === changeName);
  if (paired !== undefined) return paired;
  return survey?.directories.find((directory) =>
    directory.branch === changeName
    && directory.readable
    && directory.changes.some((change) => change.changeName === changeName));
}

/** Where the named change is worked, as this survey sees it.
 *
 * A survey that could not be taken reads every change as taken up by
 * nobody: a view that cannot see the other directories should say it knows
 * of nobody, not invent a holder. */
export function changeOwnership(changeName: string, survey: WorktreeSurvey | undefined): ChangeOwnership {
  const owner = directoryWorking(changeName, survey);
  if (owner === undefined) return { kind: "nobody" };
  if (owner.isThis) return { kind: "here" };

  const where = {
    label: owner.label,
    path: owner.path,
    ...(owner.branch !== undefined ? { branch: owner.branch } : {}),
  };
  const { person, unverified } = personOf(owner);
  if (unverified) return { kind: "unverified", ...where };
  return { kind: "elsewhere", ...where, ...(person !== undefined ? { person } : {}) };
}

/** The change this working directory is working, where it is working one.
 * Read by the same two rules `changeOwnership` reads by, so a view's
 * title and its rows cannot disagree. */
export function ownChangeOf(survey: WorktreeSurvey | undefined): string | undefined {
  const here = survey?.directories.find((directory) => directory.isThis);
  if (here === undefined) return undefined;
  if (here.belongsTo !== undefined) return here.belongsTo;
  return here.readable
    && here.branch !== undefined
    && here.changes.some((change) => change.changeName === here.branch)
    ? here.branch
    : undefined;
}

/** Every active change of this checkout, paired with where it is worked.
 * One pass, so a surface drawing a list asks once. */
export function changeOwnerships(
  changeNames: readonly string[],
  survey: WorktreeSurvey | undefined,
): Map<string, ChangeOwnership> {
  return new Map(changeNames.map((name) => [name, changeOwnership(name, survey)]));
}

/** What a row says about whose the change is, or `undefined` where there
 * is nothing to add.
 *
 * Two answers say nothing. This directory's own change needs no caption,
 * being the one the whole view is about; and a change nobody has taken up
 * is the ordinary case - a repository worked in one directory would
 * otherwise caption every row with the same words, which is how a caption
 * stops being read. Silence here means "nobody has it", and the two
 * answers that do print are the ones a reader must not miss. */
export function describeOwnership(ownership: ChangeOwnership): string | undefined {
  switch (ownership.kind) {
    case "here":
    case "nobody":
      return undefined;
    case "unverified":
      return `worked in ${ownership.label}, by a record that does not check out`;
    case "elsewhere":
      return ownership.person === undefined
        ? `worked in ${ownership.label}`
        : `worked in ${ownership.label}, by ${ownership.person}`;
  }
}

/** Whether this checkout may write to the change. False is a statement,
 * not a lock: the files are in this checkout and git will let anybody edit
 * them. What it governs is what this product offers to do, the same
 * position ADR 0028 takes for a stop. */
export function isOursToWrite(ownership: ChangeOwnership): boolean {
  return ownership.kind === "here" || ownership.kind === "nobody";
}

/** Why a command refused, in the words it tells the person. The useful
 * thing to know is not "no" but "over there". */
export function refuseToWrite(changeName: string, ownership: ChangeOwnership): string | undefined {
  if (isOursToWrite(ownership)) return undefined;
  const where = ownership as { label: string; path: string };
  return `${changeName} is worked in ${where.label} (${where.path}). Work on it there:`
    + " changing this checkout's copy would collide with theirs.";
}

/** A change worked in another working directory that this checkout does
 * not have at all - the directory was cut before that change was
 * proposed. Invisible in a view that lists this checkout's own changes,
 * and the reason such a view says how many there are rather than nothing.
 */
export interface ChangeOnlyElsewhere {
  changeName: string;
  label: string;
  path: string;
}

/** Those changes, in the order the survey lists their directories. */
export function changesOnlyElsewhere(
  survey: WorktreeSurvey | undefined,
  here: ReadonlySet<string>,
): ChangeOnlyElsewhere[] {
  const found: ChangeOnlyElsewhere[] = [];
  const seen = new Set<string>();
  for (const directory of survey?.directories ?? []) {
    if (directory.isThis) continue;
    // The same two readings: the survey's pairing, or a directory whose
    // branch bears the name of a change it holds.
    const name = directory.belongsTo
      ?? (directory.readable
        && directory.branch !== undefined
        && directory.changes.some((change) => change.changeName === directory.branch)
        ? directory.branch
        : undefined);
    if (name === undefined || here.has(name) || seen.has(name)) continue;
    seen.add(name);
    found.push({ changeName: name, label: directory.label, path: directory.path });
  }
  return found;
}

/** The one line a view shows for them, or `undefined` where there are
 * none. */
export function describeChangesOnlyElsewhere(found: readonly ChangeOnlyElsewhere[]): string | undefined {
  if (found.length === 0) return undefined;
  const count = found.length === 1 ? "1 change is" : `${found.length} changes are`;
  return `${count} worked in other working directories, and not in this one`;
}
