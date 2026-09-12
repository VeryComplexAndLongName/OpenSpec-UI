// `openspec-ui-cli doctor` — what would stop a run here, asked before
// starting one (a-doctor-says-what-would-stop-a-run).
//
// Presentation only. What this machine and this workspace have is read
// by core (`readEnvironmentReport`), and whether one named change may
// start is answered by the same `resolveChainStart` a run would use;
// this turns either into something a person reads and an exit code.

import {
  buildDefaultAgentRunners,
  readEnvironmentReport,
  resolveChainStart,
  resolveRunner,
  stopsARun,
  type EnvironmentReport,
} from "@openspec-ui/core";

export interface DoctorOptions {
  workspaceRoot: string;
  /** Ask about one change as well: the preflight's own answer for it. */
  changeName?: string;
  /** Whether a confirmation could be put to anybody from here — the
   * same fact `run` derives its refusal from, passed in rather than read
   * off `process.stdin` a second time. */
  canAnswerCheckpoints: boolean;
  format: "text" | "json";
}

export interface DoctorDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams, the same shape `leaseCommand` already offers. */
  read?: typeof readEnvironmentReport;
  resolveStart?: typeof resolveChainStart;
}

interface ChangeAnswer {
  changeName: string;
  canStart: boolean;
  reason?: string;
  configKey?: string;
}

/** `0` nothing found would stop a run, `1` something would, `2` the
 * report could not be produced.
 *
 * A workspace held by a live run exits `0`: it is a fact, not a fault,
 * and `lease` already reports being held without calling it a failure. */
export async function doctorCommand(options: DoctorOptions, deps: DoctorDeps): Promise<number> {
  let report: EnvironmentReport;
  try {
    report = await (deps.read ?? readEnvironmentReport)({ workspaceRoot: options.workspaceRoot });
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not look at this workspace: ${message(error)}`);
    return 2;
  }

  let change: ChangeAnswer | undefined;
  if (options.changeName !== undefined) {
    try {
      change = await askAboutChange(options, deps);
    } catch (error) {
      deps.stderr(`openspec-ui-cli: could not resolve "${options.changeName}": ${message(error)}`);
      return 2;
    }
  }

  const blocked = stopsARun(report) || change?.canStart === false;

  if (options.format === "json") {
    deps.stdout(JSON.stringify({ ...report, ...(change ? { change } : {}) }, null, 2));
    return blocked ? 1 : 0;
  }

  for (const line of describe(report, change)) deps.stdout(line);
  return blocked ? 1 : 0;
}

/** The preflight's own answer, from the same resolver a run is given.
 * Not a second implementation of "may this change start": two of those
 * drift, and the drift shows up as a doctor that says yes to a run that
 * is then refused. */
async function askAboutChange(options: DoctorOptions, deps: DoctorDeps): Promise<ChangeAnswer> {
  const changeName = options.changeName as string;
  const runners = buildDefaultAgentRunners({ workspaceRoot: options.workspaceRoot });
  const start = await (deps.resolveStart ?? resolveChainStart)({
    workspaceRoot: options.workspaceRoot,
    changeName,
    canAnswerCheckpoints: options.canAnswerCheckpoints,
    resolveRunner: (agentId) => resolveRunner(runners, agentId),
  });
  if (start.ok) return { changeName, canStart: true };
  return {
    changeName,
    canStart: false,
    reason: start.refusal.reason,
    ...(start.refusal.configKey !== undefined ? { configKey: start.refusal.configKey } : {}),
  };
}

function describe(report: EnvironmentReport, change: ChangeAnswer | undefined): string[] {
  const lines: string[] = [];
  const stopping = report.findings.filter((finding) => finding.severity === "stops-a-run");
  const worthKnowing = report.findings.filter((finding) => finding.severity === "worth-knowing");

  if (stopping.length === 0) {
    lines.push("Nothing here would stop a run.");
  } else {
    lines.push(stopping.length === 1 ? "One thing would stop a run:" : `${stopping.length} things would stop a run:`);
    for (const finding of stopping) {
      lines.push(`  ${finding.statement}`);
      if (finding.remedy) lines.push(`    ${finding.remedy}`);
    }
  }

  if (worthKnowing.length > 0) {
    lines.push("Worth knowing:");
    for (const finding of worthKnowing) {
      lines.push(`  ${finding.statement}`);
      if (finding.remedy) lines.push(`    ${finding.remedy}`);
    }
  }

  if (change) {
    lines.push(change.canStart
      ? `"${change.changeName}" would start here.`
      : `"${change.changeName}" would not start here: ${change.reason}`);
    if (change.configKey) lines.push(`  the setting that governs this is ${change.configKey}`);
  }

  return lines;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
