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
import { AGENT_REGISTRY, type AgentProvider } from "./agents/registry.js";
import { describeDiagnosis, type FailureDiagnosis } from "./failure-diagnosis.js";
import type { ResolvedSupervisor } from "./harness-config.js";
import type { HarnessStepAgentStage } from "./harness-step-agent.js";
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
          + (report.waiting.kind === "question" ? "." : " where it was started."),
        // A question is answered from anywhere, so the answer is offered
        // beside the look; nothing here ever stops a waiting run
        // (the-agent-asks-the-operator, ADR 0042).
        commands: [
          status,
          ...(report.waiting.kind === "question" && report.changeName !== null
            ? report.waiting.questions.map((question) =>
              `openspec-ui-cli answer ${report.changeName} ${question.questionId} "<answer>" --cwd ${report.workingDirectory}`)
            : []),
        ],
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
    // The agent `act` would move the stage to, where the change's policy
    // allows one; said, never done (the-supervisor-changes-agents).
    const supervisor = inputs.supervisorFor(changeName);
    const move = run.stage !== undefined && run.agent !== undefined && isHarnessStepAgentStageName(run.stage)
      ? superviseFailure({ stage: run.stage, current: run.agent, tried: [run.agent], diagnosis, supervisor })
      : undefined;
    const fallback = move?.action === "move"
      ? ` Its fallback for ${run.stage}, ${move.agent}, is allowed by this change's policy${supervisor.mode === "act" ? "" : "; under supervisor.mode \"act\" a chain would move the stage to it"}.`
      : "";
    hints.push({
      id: `last-run-cannot-be-repeated:${changeName}:${run.runId}`,
      kind: "last-run-cannot-be-repeated",
      subject: `${changeName}'s last run failed${at}, and repeating it will not help`,
      because: `${capitalised(describeDiagnosis(diagnosis))}.${evidence}`
        + (diagnosis.remedy !== undefined ? ` ${diagnosis.remedy}` : "")
        + fallback,
      commands: [...(diagnosis.commands ?? [])],
    });
  }
  return hints;
}

function capitalised(text: string): string {
  return text.length === 0 ? text : `${text[0]?.toUpperCase() ?? ""}${text.slice(1)}`;
}

const AGENT_STAGES: ReadonlySet<string> = new Set(["propose", "review", "apply", "verify"]);

function isHarnessStepAgentStageName(stage: string): stage is HarnessStepAgentStage {
  return AGENT_STAGES.has(stage);
}

/** What the supervisor does about a failed stage under `act`
 * (the-supervisor-changes-agents, ADR 0039 decision 4). */
export type FailureDecision =
  | { action: "repeat"; agent: string; because: string }
  | { action: "move"; agent: string; because: string }
  | { action: "none"; why: string };

export interface FailureFactsForDecision {
  stage: HarnessStepAgentStage;
  /** The agent the stage failed on. */
  current: string;
  /** Every agent this stage has run on in this chain, the current one
   * included: a fallback is never tried twice. */
  tried: readonly string[];
  diagnosis: FailureDiagnosis | undefined;
  supervisor: Pick<ResolvedSupervisor, "fallback" | "allowCostIncrease" | "allowProviderChange">;
}

function providerOf(agent: string): AgentProvider | undefined {
  return AGENT_REGISTRY.find((descriptor) => descriptor.id === agent)?.provider;
}

/** Why the policy refuses a move from `current` to `candidate`, or
 * `undefined` where it allows it. Any move but one to the local model may
 * cost more: nothing here knows one service's price against another's. */
export function fallbackRefusal(
  current: string,
  candidate: string,
  supervisor: Pick<ResolvedSupervisor, "allowCostIncrease" | "allowProviderChange">,
): string | undefined {
  const from = providerOf(current);
  const to = providerOf(candidate);
  if (to === undefined) return `${candidate} is not a registered agent`;
  if (to !== from && !supervisor.allowProviderChange) {
    return `${candidate} is another provider (${to}), and allowProviderChange is false`;
  }
  if (to !== "local" && !supervisor.allowCostIncrease) {
    return `${candidate} may cost money, and allowCostIncrease is false`;
  }
  return undefined;
}

/** Repeat the stage, move it to a fallback, or leave the failure as it is.
 * A pure function of what the chain already holds: the failure's
 * diagnosis, the stage's fallback list and the change's policy. */
export function superviseFailure(facts: FailureFactsForDecision): FailureDecision {
  const { diagnosis } = facts;
  if (diagnosis === undefined || diagnosis.repeatHelps === "unknown") {
    return { action: "none", why: "the cause is not known, so the stage is neither repeated nor moved" };
  }
  const cause = describeDiagnosis(diagnosis);
  if (diagnosis.repeatHelps === "likely") {
    return { action: "repeat", agent: facts.current, because: `${cause}` };
  }
  const fallback = facts.supervisor.fallback[facts.stage] ?? [];
  if (fallback.length === 0) {
    return { action: "none", why: `${cause}, and ${facts.stage} names no fallback agent` };
  }
  const refusals: string[] = [];
  for (const candidate of fallback) {
    if (facts.tried.includes(candidate)) continue;
    const refusal = fallbackRefusal(facts.current, candidate, facts.supervisor);
    // A fallback passed over on the way is named too: a move that skipped
    // one says why, not only where it went.
    if (refusal === undefined) {
      return { action: "move", agent: candidate, because: refusals.length > 0 ? `${cause} (passed over: ${refusals.join("; ")})` : cause };
    }
    refusals.push(refusal);
  }
  return {
    action: "none",
    why: refusals.length > 0
      ? `${cause}, and the policy refuses every fallback left: ${refusals.join("; ")}`
      : `${cause}, and every fallback for ${facts.stage} has been tried`,
  };
}

/** What the supervisor points out, in the order a person deals with it:
 * runs first, since they are spending now, then changes whose last run
 * cannot simply be tried again. */
export function superviseRuns(inputs: SuperviseInputs): Hint[] {
  return [...aboutRuns(inputs), ...aboutLastRuns(inputs)];
}
