// `openspec-ui-cli ready` — what can start now, and alongside what.
//
// Presentation only. Which changes are running, what blocks the rest,
// and which pairs collide are all decided in core
// (`change-readiness.ts`, ADR 0024); this turns that into something a
// person reads and an exit code.

import {
  describeCollision,
  readChangeReadiness,
  type ChangeReadinessReport,
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

  if (options.format === "json") {
    deps.stdout(JSON.stringify(report, null, 2));
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
      const seconds = Math.round(holder.heartbeatAgeMs / 1000);
      deps.stdout(`  ${change.changeName}`);
      deps.stdout(`      in ${worktreePath} (pid ${holder.pid}, last active ${seconds}s ago)`);
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
    }
    deps.stdout("");
  }

  if (blocked.length > 0) {
    deps.stdout("Blocked");
    for (const change of blocked) {
      if (change.run.state !== "blocked") continue;
      deps.stdout(`  ${change.changeName}`);
      deps.stdout(`      waiting on ${change.run.blockedBy.join(", ")}`);
    }
    deps.stdout("");
  }

  deps.stdout(`${ready.length} ready, ${running.length} running, ${blocked.length} blocked.`);
  return 0;
}
