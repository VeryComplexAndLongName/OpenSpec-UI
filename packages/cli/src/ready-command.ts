// `openspec-ui-cli ready` — what can start now, and alongside what.
//
// Presentation only. Which changes are running, what blocks the rest,
// and which pairs collide are all decided in core
// (`change-readiness.ts`, ADR 0024); this turns that into something a
// person reads and an exit code.

import {
  describeChangeState,
  describeCollision,
  describeStandingSources,
  readChangeReadiness,
  readChangeStandings,
  type ChangeReadiness,
  type ChangeReadinessReport,
  type ChangeStandings,
  type DescribedChangeState,
} from "@openspec-ui/core";

export interface ReadyOptions {
  workspaceRoot: string;
  base?: string;
  format: "text" | "json";
}

export interface ReadyDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seam, the same shape `validateAll` already is. */
  read?: typeof readChangeReadiness;
  /** Test seam for where each change stands. A test that fakes the report
   * reads no standings unless it gives this too, so no git and no `gh` runs
   * for a report that was never read from a repository. */
  readStandings?: (workspaceRoot: string) => Promise<ChangeStandings>;
}

/** Where each change stands, without a fetch: a terminal reading answers from
 * the refs it has, and says how old they are (a-change-says-where-it-stands). */
async function standingsFor(options: ReadyOptions, deps: ReadyDeps): Promise<ChangeStandings | undefined> {
  const read = deps.readStandings ?? (deps.read === undefined ? (root: string) => readChangeStandings(root, { fetch: "never" }) : undefined);
  if (read === undefined) return undefined;
  return await read(options.workspaceRoot).catch(() => undefined);
}

/** The one word core gives each change, with this checkout's readiness among
 * its facts, so the terminal says what every other surface says. */
function statesOf(report: ChangeReadinessReport, standings: ChangeStandings | undefined): Map<string, DescribedChangeState> {
  const states = new Map<string, DescribedChangeState>();
  if (standings === undefined) return states;
  const byName = new Map(standings.standings.map((standing) => [standing.changeName, standing]));
  for (const change of report.changes) {
    const standing = byName.get(change.changeName);
    if (standing !== undefined) states.set(change.changeName, describeChangeState({ standing, readiness: change.run.state }));
  }
  return states;
}

function printState(deps: ReadyDeps, change: ChangeReadiness, states: ReadonlyMap<string, DescribedChangeState>): void {
  const state = states.get(change.changeName);
  if (state === undefined) return;
  const lines = state.lines.map((line) => line.text).join(" · ");
  deps.stdout(`      where it stands: ${state.word}${lines.length > 0 ? ` (${lines})` : ""}`);
}

/** Always `0` where the report could be produced, and `2` where it
 * could not.
 *
 * Deliberately not `1` for "nothing is ready": a repository whose
 * changes are all running, or all waiting on each other, is in a
 * perfectly good state and reporting it as a failure would make this
 * unusable in anything that checks an exit code. */
export async function readyCommand(options: ReadyOptions, deps: ReadyDeps): Promise<number> {
  let report: ChangeReadinessReport;
  try {
    report = await (deps.read ?? readChangeReadiness)({
      workspaceRoot: options.workspaceRoot,
      ...(options.base !== undefined ? { base: options.base } : {}),
    });
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not read what is ready: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  const standings = await standingsFor(options, deps);
  const states = statesOf(report, standings);

  if (options.format === "json") {
    // The report in core's own shape, with each change's word beside it where
    // standings could be read.
    deps.stdout(JSON.stringify(standings === undefined ? report : { ...report, states: Object.fromEntries(states) }, null, 2));
    return 0;
  }

  if (report.changes.length === 0) {
    deps.stdout("No active changes.");
    return 0;
  }

  const running = report.changes.filter((change) => change.run.state === "running");
  const blocked = report.changes.filter((change) => change.run.state === "blocked");
  const ready = report.changes.filter((change) => change.run.state === "ready");

  if (running.length > 0) {
    deps.stdout("Running");
    for (const change of running) {
      if (change.run.state !== "running") continue;
      const { holder, worktreePath } = change.run;
      deps.stdout(`  ${change.changeName}`);
      if (holder) {
        const seconds = Math.round(holder.heartbeatAgeMs / 1000);
        deps.stdout(`      in ${worktreePath} (pid ${holder.pid}, last active ${seconds}s ago)`);
      } else {
        // A record says a run is on it, and a record names no host, pid or
        // author, so nothing is claimed about who
        // (a-change-is-running-when-its-run-says-so).
        deps.stdout(`      in ${worktreePath} (its run reports it)`);
      }
      printState(deps, change, states);
    }
    deps.stdout("");
  }

  if (ready.length > 0) {
    deps.stdout("Ready");
    for (const change of ready) {
      deps.stdout(`  ${change.changeName}`);
      if (change.needsWorktree) {
        // The lease permits one mutating run per working directory, so
        // this one is startable instead of another, not alongside it.
        deps.stdout(`      no working directory of its own — ${change.needsWorktree}`);
      } else if (change.canJoin.length > 0) {
        deps.stdout(`      can start alongside: ${change.canJoin.join(", ")}`);
      } else {
        deps.stdout("      nothing else can start alongside it");
      }
      for (const other of change.blockedFrom) {
        const why = other.collisions.map(describeCollision).join("; ");
        deps.stdout(`      not with ${other.changeName} — ${why}`);
      }
      printState(deps, change, states);
    }
    deps.stdout("");
  }

  if (blocked.length > 0) {
    deps.stdout("Blocked");
    for (const change of blocked) {
      if (change.run.state !== "blocked") continue;
      deps.stdout(`  ${change.changeName}`);
      deps.stdout(`      waiting on ${change.run.blockedBy.join(", ")}`);
      printState(deps, change, states);
    }
    deps.stdout("");
  }

  deps.stdout(`${ready.length} ready, ${running.length} running, ${blocked.length} blocked.`);
  if (standings !== undefined) deps.stdout(describeStandingSources(standings.sources));
  return 0;
}
