// What has to leave a working directory before it is removed — ADR 0027.
//
// A working directory's `.openspec-ui/` is gitignored, so its run
// history cannot leave by commit. And `git worktree remove` without
// `--force` refuses uncommitted TRACKED work but does not see ignored
// files: measured in a throwaway repository, the ignored log leaves the
// directory clean, removal exits 0, and the log is gone. The tool
// destroys its own evidence at the moment that evidence first becomes
// interesting.
//
// So removal harvests first. What is not taken is NAMED rather than
// deleted quietly: a destroyed thing that was announced is a decision;
// one that was not is a discovery, made later, by whoever needed it.

import { access, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditLogPath } from "./security.js";

export interface HarvestResult {
  /** Entries added to the repository's own log. Zero where the
   * directory recorded nothing, or where everything was already there. */
  entriesTaken: number;
  /** Traces and videos the browser suite kept, taken where present.
   * They exist only where something failed, which is when somebody
   * wants them. */
  failureArtifacts: number;
  /** Things left behind, in the words a person is told them in. Empty
   * where the directory held nothing worth naming. */
  discarded: string[];
}

/** Copies a working directory's run history into the repository's own,
 * and reports what is being left behind.
 *
 * Nothing is deleted here. This runs BEFORE removal, and removal is
 * somebody else's call — so a failure to harvest leaves the directory
 * intact rather than half-emptied. */
export async function harvestWorktree(options: {
  repositoryRoot: string;
  worktreePath: string;
}): Promise<HarvestResult> {
  const entriesTaken = await mergeAuditLog(options.worktreePath, options.repositoryRoot);
  const failureArtifacts = await takeFailureArtifacts(options.worktreePath, options.repositoryRoot);
  return {
    entriesTaken,
    failureArtifacts,
    discarded: await describeWhatStays(options.worktreePath),
  };
}

/** Traces and videos the browser suite kept.
 *
 * Playwright is configured `retain-on-failure`, so this directory exists
 * only where something failed — which is exactly when somebody wants it,
 * and exactly the run whose evidence would otherwise go with the
 * directory. Copied under a name that says which directory it came from,
 * because two harvests would otherwise land on each other. */
async function takeFailureArtifacts(worktreePath: string, repositoryRoot: string): Promise<number> {
  const source = path.join(worktreePath, "packages", "server", "test-results");
  const entries = await countEntries(source);
  if (entries === 0) return 0;

  const destination = path.join(
    repositoryRoot,
    ".openspec-ui",
    "harvested-test-results",
    path.basename(path.resolve(worktreePath)),
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
  return entries;
}

/** Appends the entries of one log into another, skipping those already
 * there.
 *
 * Merging needs no rewriting: an entry already records its own `cwd` and
 * `changeDir`, so a combined log says where each run happened. `runId`
 * makes it idempotent — harvesting twice adds nothing the second time,
 * which matters because a person may well run the command again after
 * one failed for another reason. */
async function mergeAuditLog(worktreePath: string, repositoryRoot: string): Promise<number> {
  const source = auditLogPath(worktreePath);
  const destination = auditLogPath(repositoryRoot);

  const incoming = await readJsonLines(source);
  if (incoming.length === 0) return 0;

  const known = new Set(
    (await readJsonLines(destination))
      .map((line) => runIdOf(line))
      .filter((id): id is string => id !== undefined),
  );

  // A line whose runId cannot be read is kept rather than dropped: it is
  // evidence of something, and this is the last chance anybody has to
  // look at it.
  const fresh = incoming.filter((line) => {
    const id = runIdOf(line);
    return id === undefined || !known.has(id);
  });
  if (fresh.length === 0) return 0;

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${fresh.join("\n")}\n`, { encoding: "utf8", flag: "a" });
  return fresh.length;
}

async function readJsonLines(filePath: string): Promise<string[]> {
  try {
    return (await readFile(filePath, "utf8")).split(/\r?\n/).filter((line) => line.trim().length > 0);
  } catch {
    // Missing or unreadable: a directory that recorded nothing is the
    // ordinary case, not a failure.
    return [];
  }
}

function runIdOf(line: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const id = (parsed as Record<string, unknown>).runId;
    return typeof id === "string" ? id : undefined;
  } catch {
    return undefined;
  }
}

/** What removal is about to destroy that is not in git and is not taken.
 *
 * Named, not taken, and the distinction is deliberate. The run journal
 * is recovery state whose value expires with the runs it describes; the
 * checkpoints are the before-and-after a rollback would use, and their
 * purpose ends when the change archives. The lease is not named at all —
 * it is ephemeral by construction and there is nothing to say about it. */
async function describeWhatStays(worktreePath: string): Promise<string[]> {
  const directory = path.join(worktreePath, ".openspec-ui");
  const discarded: string[] = [];

  if (await exists(path.join(directory, "workbench-runs.json"))) {
    discarded.push("the run journal, which describes runs that have ended");
  }

  const checkpoints = await countEntries(path.join(directory, "checkpoints"));
  if (checkpoints > 0) {
    discarded.push(`${checkpoints} checkpoint${checkpoints === 1 ? "" : "s"}, which a rollback would have used`);
  }

  return discarded;
}

async function countEntries(directory: string): Promise<number> {
  try {
    return (await readdir(directory)).length;
  } catch {
    return 0;
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
