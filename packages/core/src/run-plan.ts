// What one entry says it will do before it does it.
//
// Two entries used to lead to three paths, and which one a person wanted
// was a value in a file that one of the entries did not read. The
// decision itself already lived in one place (`resolveRunWithHarnessTarget`);
// what did not exist was a description of it, so a surface could act on a
// configuration and show nothing of what it read.
//
// Pure and browser-safe, like `harness-dispatch.ts` beside it and for the
// same reason: both hosts must describe a run identically, and a second
// implementation is a second set of sentences to drift.

import { resolveRunWithHarnessTarget } from "./harness-dispatch.js";
import { findHarnessConfigLimits, type HarnessFinding } from "./harness-config-findings.js";
import { recommendTemplate, type HarnessRecommendation, type RecommendationInput } from "./harness-recommendation.js";
import { normalizeStepAgent, VSCODE_CHAT_STEP_AGENT_ID, type HarnessStepAgentStage } from "./harness-step-agent.js";
import type { HarnessAutonomyLevel, HarnessConfig } from "./harness-config.js";

/** The three ways a change can be worked on. `chain` and `single-stage`
 * are what the two autonomy levels already resolve to; `vscode-agent` is
 * the `apply` stage run by `vscode-chat`, which is already a step agent
 * — it looked like a separate thing only because it had its own command. */
export type RunPathId = "chain" | "single-stage" | "vscode-agent";

export interface RunPath {
  id: RunPathId;
  title: string;
  /** What this path does, in one sentence a person reads before starting. */
  describes: string;
}

export interface RunPlan {
  /** The path the change's own configuration resolves to. Pre-selected,
   * never silently applied without being shown. */
  resolved: RunPathId;
  /** Why it resolved that way, naming the setting rather than implying
   * the answer came from nowhere. */
  because: string;
  /** The agent configured for each stage, in stage order.
   *
   * Listed for the single-stage path too, and not reduced to one agent
   * there: which stage runs is chosen in the picker afterwards, so naming
   * a single agent here would be a guess dressed as a statement. An entry
   * whose agent is absent says so — no agent is configured for that
   * stage, which is a fact rather than a blank. */
  stageAgents: ReadonlyArray<{ stage: HarnessStepAgentStage; agent?: string }>;
  /** The paths this host can actually offer. A path that cannot run here
   * is not listed — offering one is the same defect as a ceiling that
   * cannot act. */
  offered: readonly RunPath[];
  /** Ceilings in this configuration that cannot act — one set below what
   * a stage costs, one so high nothing reaches it, an agent that reports
   * no spend at all.
   *
   * Shown before the run rather than after. A ceiling that cannot act is
   * worth knowing while the money has not been spent. */
  findings: readonly HarnessFinding[];
  /** Which named configuration suits this change, with the observations
   * behind it. Absent where the caller supplied nothing to reason from —
   * "no recommendation" and "a recommendation with no grounds" are
   * different, and only the first is honest. */
  advice?: HarnessRecommendation;
}

/** Whether the host can open VS Code Chat. The standalone UI cannot, and
 * a dialog offering it there would name a path that does nothing. */
export interface RunPlanHost {
  hasVsCodeAgent: boolean;
  /** What this change has left to do and how its previous runs ended, for
   * the recommendation. Optional because a host that cannot read the task
   * list or the audit log has nothing to reason from, and should say so
   * by omission rather than by recommending from nothing. */
  recommendationInput?: RecommendationInput;
}

const CHAIN_STAGES: readonly HarnessStepAgentStage[] = ["propose", "review", "apply", "verify"];

const PATHS: Readonly<Record<RunPathId, RunPath>> = {
  chain: {
    id: "chain",
    title: "Run the chain",
    describes: "Runs propose, review, apply and verify in sequence, pausing where the configuration says to.",
  },
  "single-stage": {
    id: "single-stage",
    title: "Run one stage",
    describes: "Starts a single stage you pick, and stops when it ends.",
  },
  "vscode-agent": {
    id: "vscode-agent",
    title: "Implement with the VS Code agent",
    describes: "Opens VS Code Chat in agent mode on this change's apply stage.",
  },
};

function describeAutonomy(level: HarnessAutonomyLevel, resolved: RunPathId): string {
  return resolved === "chain"
    ? `autonomyLevel is "${level}", so a chain runs rather than one stage`
    : `autonomyLevel is "${level}", so one stage runs and you start each one`;
}

function agentFor(config: HarnessConfig, stage: HarnessStepAgentStage): string | undefined {
  const entry = config.stepAgents[stage];
  return entry === undefined ? undefined : normalizeStepAgent(entry).agent;
}

/** Describes what starting this change will do, without doing it.
 *
 * The resolved path comes from `resolveRunWithHarnessTarget`, the same
 * decision the run itself makes — this adds the sentence, not a second
 * opinion. */
export function buildRunPlan(config: HarnessConfig, host: RunPlanHost): RunPlan {
  const resolved: RunPathId = resolveRunWithHarnessTarget(config) === "chain" ? "chain" : "single-stage";
  const offered: RunPath[] = [PATHS.chain, PATHS["single-stage"]];
  if (host.hasVsCodeAgent) offered.push(PATHS["vscode-agent"]);

  return {
    resolved,
    because: describeAutonomy(config.autonomyLevel, resolved),
    stageAgents: CHAIN_STAGES.map((stage) => ({ stage, agent: agentFor(config, stage) })),
    offered,
    findings: findHarnessConfigLimits(config),
    ...(host.recommendationInput !== undefined
      ? { advice: recommendTemplate(host.recommendationInput) }
      : {}),
  };
}

/** The agent a chosen path will actually run, which is not always the
 * configured one: choosing the VS Code agent means `vscode-chat` for this
 * run whatever the file says. Returned rather than written — a run is not
 * a configuration change. */
export function agentForChosenPath(config: HarnessConfig, path: RunPathId): string | undefined {
  if (path === "vscode-agent") return VSCODE_CHAT_STEP_AGENT_ID;
  return agentFor(config, "apply");
}
