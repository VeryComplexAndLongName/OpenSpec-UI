// When every change of a workspace was proposed and archived, and how much
// of each is done, read in one pass (the-timeline-compares-changes).
//
// The comparison screen needs every change's dates before it can draw
// anything. Read one change at a time — a `git log --follow` over each
// `proposal.md` — this repository's 264 changes cost 62 seconds, measured
// 2026-09-17. The same four reads for the whole workspace cost 1.2 s: the
// discovery, one `git log` over both `proposal.md` globs, the archive's own
// one-call read, and every `tasks.md` counted.
//
// The dates mean exactly what `getChangeTimeline`'s dates mean: they are
// assembled by `buildChangeDates`, the same function, so a source word here
// is the source word there. What differs is how the evidence was gathered,
// and only for a change renamed after it was proposed — see
// `readProposalAddedDates` below.

import { readFile } from "node:fs/promises";
import simpleGit, { type SimpleGit } from "simple-git";
import { mapBounded } from "./bounded-map.js";
import { buildChangeDates, withoutArchivePrefix, type DatedFact } from "./change-dates.js";
import { countTaskCheckboxes, type TaskCounts } from "./change-standing-facts.js";
import { readArchiveCommitDates } from "./change-timeline.js";
import { CHANGES_READ_AT_ONCE, discoverOpenSpecWorkspace, type WorkbenchChange } from "./workbench.js";

/** One change's span: when it was proposed, when it was archived, and how
 * many of its tasks are done. */
export interface ChangeSpan {
  /** The change's directory name — an archived one carries its date
   * prefix, as every other reading of the workspace reports it. */
  changeName: string;
  archived: boolean;
  dates: {
    proposed: DatedFact;
    /** Absent (`source: "none"`) for an active change. */
    archived: DatedFact;
  };
  /** `null` where the change has no `tasks.md`, or where it could not be
   * read — a change with no list and a change with an empty one are
   * different facts. */
  tasks: TaskCounts | null;
}

export interface ChangeSpans {
  /** When the pass ran, so a screen can say how current it is. */
  readAt: string;
  spans: ChangeSpan[];
  /** Lines of the archive's one-call read that were neither a date nor a
   * path, carried for the same reason `getChangeTimelines` carries them:
   * a short read should be visible rather than silent. Absent when
   * nothing fell short. */
  archiveDatesUnreadableLines?: number;
}

/** Every change of a workspace with its dates and its task counts.
 *
 * Never throws for a workspace without git: each date falls back on its
 * own and says which source answered, exactly as the per-change read
 * does. */
export async function readChangeSpans(root: string): Promise<ChangeSpans> {
  const workspace = await discoverOpenSpecWorkspace(root);
  const changes = [...workspace.changes, ...workspace.archivedChanges];
  const [proposed, archive] = await Promise.all([
    readProposalAddedDates(root),
    changes.some((change) => change.archived)
      ? readArchiveCommitDates(root)
      : Promise.resolve(undefined),
  ]);

  const spans = await mapBounded(changes, CHANGES_READ_AT_ONCE, async (change): Promise<ChangeSpan> => {
    const dates = buildChangeDates({
      changeName: change.name,
      archived: change.archived,
      proposalAddedDate: proposed.get(withoutArchivePrefix(change.name)) ?? null,
      archiveCommitDate: change.archived ? archive?.dates.get(change.name) ?? null : null,
    });
    return {
      changeName: change.name,
      archived: change.archived,
      dates: { proposed: dates.proposed, archived: dates.archived },
      tasks: await readTaskCounts(change),
    };
  });

  return {
    readAt: new Date().toISOString(),
    spans,
    ...(archive && archive.unreadableLines > 0
      ? { archiveDatesUnreadableLines: archive.unreadableLines }
      : {}),
  };
}

async function readTaskCounts(change: WorkbenchChange): Promise<TaskCounts | null> {
  const tasks = change.artifacts.find((artifact) => artifact.id === "tasks");
  if (!tasks?.exists) return null;
  try {
    return countTaskCheckboxes(await readFile(tasks.path, "utf8"));
  } catch {
    return null;
  }
}

/** When each change's `proposal.md` was first added, from one `git log`
 * over every change directory, active and archived.
 *
 * Keyed by the change's name without its archive prefix, which is the one
 * name both paths share: archiving renames
 * `openspec/changes/<name>/proposal.md` to
 * `openspec/changes/archive/<day>-<name>/proposal.md`, and the oldest add
 * of either path is when the change was proposed. A change proposed and
 * archived in one commit has only the archived path, which is the right
 * answer for it.
 *
 * `--no-renames` is what makes both paths adds. With git's rename
 * detection on, the archiving commit reports a rename rather than an add,
 * and an archived change whose proposal commit is older than the log's
 * first page would carry no date at all.
 *
 * Deliberately not `--follow`, which cannot be asked for two paths at once
 * and which `getChangeTimeline` still uses for the one change it reads:
 * following the file finds a first draft written under another name, at
 * 240ms a change. Measured across this repository on 2026-09-17, the two
 * reads agreed to the second on 262 of 264 changes and on the day for all
 * of them; the two that differ were renamed the day they were proposed.
 * See change-spans.test.ts. */
async function readProposalAddedDates(root: string): Promise<Map<string, string>> {
  const dates = new Map<string, string>();
  try {
    const git = simpleGit(root);
    const prefix = await pathPrefixInRepository(git);
    const output = await git.raw([
      // A path with anything unusual in it is otherwise rendered as a
      // C-style quoted string, which is a path this cannot match.
      "-c",
      "core.quotePath=false",
      "log",
      "--no-renames",
      "--diff-filter=A",
      "--name-only",
      `--format=${DATE_LINE_MARK}%aI`,
      "--",
      ":(glob)openspec/changes/*/proposal.md",
      ":(glob)openspec/changes/archive/*/proposal.md",
    ]);
    let current: string | undefined;
    for (const rawLine of output.split("\n")) {
      const line = rawLine.replace(/\r$/u, "");
      if (line.length === 0) continue;
      if (line.startsWith(DATE_LINE_MARK)) {
        current = line.slice(DATE_LINE_MARK.length).trim();
        continue;
      }
      const name = changeNameFrom(line, prefix);
      // git prints newest first, so a later line for the same change is an
      // older commit: overwriting leaves the oldest add.
      if (name !== undefined && current) dates.set(name, current);
    }
  } catch {
    // No git, a shallow clone, a workspace outside a repository. Every
    // proposed date is absent and says so.
  }
  return dates;
}

/** ASCII unit separator in front of every date line, so a date is told
 * from a path by a byte git never prints raw in a path. The same mark
 * `readArchiveCommitDates` uses, and for the same reason: a workspace in
 * a directory whose name begins with the previous mark turned every path
 * into a date. */
const DATE_LINE_MARK = "\x1f";

const CHANGES_PATH = "openspec/changes/";
const ARCHIVE_PATH = "archive/";

/** The change a printed path belongs to, without its archive prefix, or
 * `undefined` for a path that is not a change's `proposal.md`. */
function changeNameFrom(filePath: string, prefix: string): string | undefined {
  const unquoted = unquoteGitPath(filePath);
  if (!unquoted.startsWith(`${prefix}${CHANGES_PATH}`)) return undefined;
  const rest = unquoted.slice(prefix.length + CHANGES_PATH.length);
  const inArchive = rest.startsWith(ARCHIVE_PATH);
  const parts = (inArchive ? rest.slice(ARCHIVE_PATH.length) : rest).split("/");
  if (parts.length !== 2 || parts[1] !== "proposal.md") return undefined;
  const name = withoutArchivePrefix(parts[0] as string);
  return name.length > 0 ? name : undefined;
}

/** What git puts in front of every path it prints, for a workspace that is
 * not the repository root — `git rev-parse --show-prefix`, which is empty
 * at the root and slash-terminated below it. */
async function pathPrefixInRepository(git: SimpleGit): Promise<string> {
  try {
    const prefix = (await git.raw(["rev-parse", "--show-prefix"])).trim();
    if (prefix.length === 0) return "";
    return prefix.endsWith("/") ? prefix : `${prefix}/`;
  } catch {
    return "";
  }
}

/** A C-style quoted path as git writes one, unquoted. `core.quotePath=false`
 * stops the common case; a path holding a quote or a control byte is still
 * quoted, and reading it is cheaper than losing the change. */
function unquoteGitPath(filePath: string): string {
  if (!filePath.startsWith("\"") || !filePath.endsWith("\"") || filePath.length < 2) return filePath;
  return filePath.slice(1, -1).replaceAll(/\\([\\"])/gu, "$1");
}
