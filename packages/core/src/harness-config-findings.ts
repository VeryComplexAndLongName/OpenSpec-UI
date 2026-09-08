// What a harness configuration cannot do — read from the configuration
// and the agents it names, before any run under it exists.
//
// A ceiling that cannot fire is indistinguishable from one that has not
// fired yet, and the difference is otherwise discovered by a bill. Every
// finding here is of one shape: this setting cannot act, and here is why.
// None recommends a value: what cannot act follows from what an agent
// reports, and what to set instead needs history this module does not
// read.
//
// Pure over a resolved config — no files, no processes — the shape
// `usage-report.ts` and `change-cost-report.ts` already use.

import { HARNESS_AGENT_CAPABILITIES, isHarnessStepAgentStage, normalizeStepAgent } from "./harness-step-agent.js";
import type { HarnessConfig } from "./harness-config.js";
import { STAGES, type HarnessStage } from "./harness-stage.js";

export type HarnessFindingKind =
  /** A configured ceiling has nothing to compare on this stage's agent. */
  | "ceiling-cannot-act"
  /** A configured ceiling can act but sees a fraction of what moves. */
  | "ceiling-rarely-acts"
  /** No ceiling of any kind bounds this stage. */
  | "stage-unbounded"
  /** The agent's reporting has never been observed, so neither of the
   * above can be asserted about it. */
  | "reporting-unknown";

export interface HarnessFinding {
  kind: HarnessFindingKind;
  stage: HarnessStage;
  agent: string;
  /** What cannot happen, and why — never what to do instead. */
  message: string;
}

const DEFAULT_AGENT_LABEL = "the default agent";

function agentForStage(config: HarnessConfig, stage: HarnessStage): string | undefined {
  if (!isHarnessStepAgentStage(stage)) return undefined;
  const entry = config.stepAgents[stage];
  return entry === undefined ? undefined : normalizeStepAgent(entry).agent;
}

/** Everything the given configuration cannot do, in the order the stages
 * run. An empty list is the good case and must stay quiet: a surface that
 * warns about a correct configuration becomes noise people learn to
 * ignore. */
export function findHarnessConfigLimits(config: HarnessConfig): HarnessFinding[] {
  const findings: HarnessFinding[] = [];
  const hasCostCeiling = config.budget?.maxCostUsd !== undefined || config.budget?.maxStageCostUsd !== undefined;
  const hasTokenCeiling = config.budget?.maxTokens !== undefined || config.budget?.maxStageTokens !== undefined;
  const hasTimeCeiling = config.timeout?.maxRunSeconds !== undefined || config.timeout?.maxStageSeconds !== undefined;

  for (const stage of STAGES) {
    if (!isHarnessStepAgentStage(stage)) continue;
    const agent = agentForStage(config, stage);
    // An unset stage runs on the host's default agent, which this module
    // cannot resolve — it is chosen at activation from what is installed.
    // Saying nothing is better than naming an agent that may not be the
    // one used.
    if (agent === undefined) continue;
    const reports = HARNESS_AGENT_CAPABILITIES[agent]?.reports ?? "unknown";

    if (reports === "unknown") {
      findings.push({
        kind: "reporting-unknown",
        stage,
        agent,
        message: `"${agent}" has never been observed reporting its usage here, so whether a spending ceiling`
          + ` can act on "${stage}" is not known. A time ceiling needs no report and applies regardless.`,
      });
      continue;
    }

    if (reports === "none") {
      if (hasCostCeiling || hasTokenCeiling) {
        findings.push({
          kind: "ceiling-cannot-act",
          stage,
          agent,
          message: `"${agent}" reports no usage at all, so no spending ceiling can act on "${stage}"`
            + " however large the spend.",
        });
      }
      if (!hasTimeCeiling) {
        findings.push({
          kind: "stage-unbounded",
          stage,
          agent,
          message: `"${stage}" can run without any bound: "${agent}" reports nothing for a spending ceiling`
            + " to compare, and no timeout is configured. A time ceiling is the only one that applies here.",
        });
      }
      continue;
    }

    if (reports === "tokens-only" && hasCostCeiling) {
      findings.push({
        kind: "ceiling-cannot-act",
        stage,
        agent,
        message: `"${agent}" reports tokens and no cost, so a cost ceiling cannot act on "${stage}".`
          + " A token ceiling is the one that can.",
      });
    }

    if (reports === "cost-and-tokens" && hasTokenCeiling) {
      findings.push({
        kind: "ceiling-rarely-acts",
        stage,
        agent,
        message: `A token ceiling counts input plus output only, and "${agent}" moves most of its tokens`
          + ` through cache — a measured run recorded 1,693,507 cache tokens against 8,322 counted ones, so`
          + ` a token ceiling will rarely act on "${stage}". A cost ceiling acts on it directly.`,
      });
    }
  }

  return findings;
}

/** The default agent's label, for a surface that wants to say why an
 * unset stage produced no finding. */
export const UNSET_STAGE_AGENT_LABEL = DEFAULT_AGENT_LABEL;
