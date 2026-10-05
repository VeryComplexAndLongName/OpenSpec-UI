// What the supervisor points out about runs - the-supervisor-advises,
// ADR 0039.
//
// Every run already says what it is doing and since when (ADR 0028), and
// every run's end is in the audit log. Nothing drew a conclusion from
// either: a run waiting for a permission nobody saw read as a hung one,
// and a run that failed because its agent was not signed in read as one
// worth trying again. This draws three, as suggestions in the shape
// `hints.ts` already has, so they are shown and printed where every other
// suggestion is.
//
// A leaf module, like `hints.ts`: a pure function of the records it is
// given, with only type imports. It has no clock of its own, no timer and
// no background anything: a threshold is checked when a reading is made.
//
// What it deliberately does not do:
//
// - Stop, start or change anything. Each suggestion carries the commands
//   a person would run; running them is theirs.
// - Say "hung" or "stuck". A long turn and a hang look the same from
//   outside; it says how long, and what the run last said (ADR 0028).

import type { AgentStatusReport } from "./agent-status.js";
import { describeDiagnosis } from "./failure-diagnosis.js";
import type { ResolvedSupervisor } from "./harness-config.js";
import type { Hint } from "./hints.js";
import type { LastRunsReport } from "./last-runs-facts.js";
import { describeWaiting } from "./worktree-survey-facts.js";

export interface SuperviseInputs {
  /** Every run's status record, as `readAgentStatuses` reads them. */
  statuses: readonly AgentStatusReport[];
  /** Each change's last ended run. */
  lastRuns: LastRunsReport;
  /** The supervisor as it resolves for a change, or for a run on no
   * change (`null`). A change may turn it off for itself. */
  supervisorFor: (changeName: string | null) => ResolvedSupervisor;
}

/** A span in the words a person reads it in. Whole units, rounded down: a
 * suggestion that says "12 minutes" is checked against a clock, and one
 * that said 12 when it was 11.6 would read as wrong. */
export function describeSpan(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 120) return seconds === 1 ? "1 second" : `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 120) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hours`;
}

function onChange(changeName: string | null): string {
  return changeName !== null ? ` on ${changeName}` : "";
}

/** A double quote cannot end the reason early in a pasted command. */
function quotedArgument(text: string): string {
  return `"${text.replace(/"/g, "'")}"`;
}

function aboutRuns(inputs: SuperviseInputs): Hint[] {
  const hints: Hint[] = [];
  for (const report of inputs.statuses) {
    // A record that does not check out says nothing that is read, and a
    // gone writer is the lease's own suggestion (`held-by-a-finished-run`).
    if (report.signature === "does-not-check-out" || report.gone) continue;
    const supervisor = inputs.supervisorFor(report.changeName);
    if (supervisor.mode === "off") continue;
    const span = describeSpan(report.activitySinceMs);
    const status = `openspec-ui-cli status --cwd ${report.workingDirectory}`;

    if (report.waiting !== null) {
      if (report.activitySinceMs <= supervisor.waitingAfterSeconds * 1000) continue;
      hints.push({
        id: `run-waits-on-you:${report.instanceId}`,
        kind: "run-waits-on-you",
        subject: `A run${onChange(report.changeName)} has waited on a person for ${span}`,
        because: `It is ${describeWaiting(report.waiting)}, longer than supervisor.waitingAfterSeconds`
          + ` (${supervisor.waitingAfterSeconds}s). A waiting run is not a hung one: it goes on once answered`
          + " where it was started.",
        commands: [status],
      });
      continue;
    }

    if (report.activitySinceMs <= supervisor.silentAfterSeconds * 1000) continue;
    hints.push({
      id: `run-says-nothing-new:${report.instanceId}`,
      kind: "run-says-nothing-new",
      subject: `A run${onChange(report.changeName)} has said nothing new for ${span}`,
      because: `Its heartbeat is ${describeSpan(report.heartbeatAgeMs)} old, so it is alive, and it last said`
        + ` "${report.activity}" ${span} ago, longer than supervisor.silentAfterSeconds`
        + ` (${supervisor.silentAfterSeconds}s). A long turn and a hang look the same from here:`
        + " look at it before asking it to stop.",
      commands: [
        status,
        `openspec-ui-cli stop ${report.instanceId} --reason ${quotedArgument(`said nothing new for ${span}`)}`
          + ` --cwd ${report.workingDirectory}`,
      ],
    });
  }
  return hints;
}

function aboutLastRuns(inputs: SuperviseInputs): Hint[] {
  // A change a live run is working on is being tried again already.
  const working = new Set(inputs.statuses
    .filter((report) => !report.gone && report.changeName !== null)
    .map((report) => report.changeName as string));
  const hints: Hint[] = [];
  for (const [changeName, run] of Object.entries(inputs.lastRuns.byChange).sort(([a], [b]) => a.localeCompare(b))) {
    const diagnosis = run.diagnosis;
    if (run.outcome !== "failed" || diagnosis === undefined || diagnosis.repeatHelps !== "no") continue;
    if (working.has(changeName)) continue;
    if (inputs.supervisorFor(changeName).mode === "off") continue;
    const at = run.stage !== undefined ? ` at ${run.stage}` : "";
    const evidence = diagnosis.evidence !== undefined ? ` It printed: "${diagnosis.evidence}".` : "";
    hints.push({
      id: `last-run-cannot-be-repeated:${changeName}:${run.runId}`,
      kind: "last-run-cannot-be-repeated",
      subject: `${changeName}'s last run failed${at}, and repeating it will not help`,
      because: `${capitalised(describeDiagnosis(diagnosis))}.${evidence}`
        + (diagnosis.remedy !== undefined ? ` ${diagnosis.remedy}` : ""),
      commands: [...(diagnosis.commands ?? [])],
    });
  }
  return hints;
}

function capitalised(text: string): string {
  return text.length === 0 ? text : `${text[0]?.toUpperCase() ?? ""}${text.slice(1)}`;
}

/** What the supervisor points out, in the order a person deals with it:
 * runs first, since they are spending now, then changes whose last run
 * cannot simply be tried again. */
export function superviseRuns(inputs: SuperviseInputs): Hint[] {
  return [...aboutRuns(inputs), ...aboutLastRuns(inputs)];
}
