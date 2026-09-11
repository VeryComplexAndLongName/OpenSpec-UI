import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AGENT_REGISTRY } from "./agents/registry.js";
import { assertValidChangeName } from "./change-name.js";
import type { ChangeLocation } from "./workbench.js";
import { STAGES, type HarnessStage } from "./harness-stage.js";
import {
  HARNESS_AUTONOMY_LEVELS,
  type HarnessAutonomyLevel,
  COPILOT_MIN_AI_CREDITS,
  HARNESS_AGENT_CAPABILITIES,
  HARNESS_EFFORT_VALUES,
  MODEL_ID_PATTERN,
  STEP_AGENT_KEYS,
  VSCODE_CHAT_STEP_AGENT_ID,
  isHarnessStepAgentStage,
  mergeStepAgent,
  mergeStepAgents,
  normalizeStepAgent,
  stepAgentFor,
  type HarnessAgentCapabilities,
  type HarnessEffort,
  type HarnessStepAgent,
  type HarnessStepAgentStage,
  type HarnessStepAgents,
  type HarnessStepBudget,
} from "./harness-step-agent.js";

export { STAGES, type HarnessStage };
export {
  COPILOT_MIN_AI_CREDITS,
  HARNESS_AGENT_CAPABILITIES,
  HARNESS_EFFORT_VALUES,
  MODEL_ID_PATTERN,
  // Re-exported from where it now lives, beside the type it describes
  // and beside the merge that reads it. Importers kept their path.
  STEP_AGENT_KEYS,
  VSCODE_CHAT_STEP_AGENT_ID,
  isHarnessStepAgentStage,
  mergeStepAgent,
  mergeStepAgents,
  normalizeStepAgent,
  stepAgentFor,
  type HarnessAgentCapabilities,
  type HarnessEffort,
  type HarnessStepAgent,
  type HarnessStepAgentStage,
  type HarnessStepAgents,
  type HarnessStepBudget,
};


// Agentic Harness config — see docs/adr/0011-agentic-harness-config-and-
// autonomy-levels.md and openspec/changes/agentic-harness/. Deliberately
// its own file pair, not new keys inside openspec/config.yaml: the
// upstream openspec CLI's config schema is a fixed Zod object that
// silently drops unrecognized keys (verified in @fission-ai/openspec's
// own source), so anything added there would look configured but do
// nothing.

// Defined in the leaf module so the surfaces read the same list this
// file enforces. Re-exported here because every existing import
// takes it from this module. See an-autonomy-level-says-what-it-does.
export type { HarnessAutonomyLevel } from "./harness-step-agent.js";
export type HarnessReviewGateMode = "human-required" | "agent-sufficient";

export interface HarnessReviewGate {
  mode: HarnessReviewGateMode;
}

export interface HarnessCheckpoints {
  requireConfirmationBetweenSteps: boolean;
}

/** A cost/token ceiling `HarnessChainRunner` checks before starting each
 * stage of a chain — see openspec/changes/agent-usage-accounting/design.md
 * and spec.md, "A configured budget stops work at stage boundaries". Both
 * fields optional and independent: a config may cap cost only, tokens
 * only, both, or (by omitting `budget` entirely) neither. */
export interface HarnessBudget {
  maxCostUsd?: number;
  maxTokens?: number;
  /** Ceiling on what one stage reports, enforced by this project rather
   * than by the agent's own command line — so it exists for every agent
   * that reports usage, where `stepAgents.<stage>.budget` reaches a CLI
   * flag only two of the ten have.
   *
   * Checked when a stage ends, against what that stage reported, and it
   * stops the chain rather than the stage: a run's cost is not known
   * until it ends, so this cannot prevent the overspend that happened,
   * only the next one. The ceiling that stops a stage mid-run is
   * `timeout`. */
  maxStageCostUsd?: number;
  /** As `maxStageCostUsd`, in tokens. Counts `inputTokens +
   * outputTokens`, the same sum `maxTokens` uses — so on a cache-heavy
   * agent it sees a fraction of what moved, and on one that reports
   * nothing it sees nothing at all. */
  maxStageTokens?: number;
}

/** Time ceilings, in seconds. Both optional and independent, the same
 * shape `HarnessBudget` established — and, unlike a spending ceiling,
 * able to stop a stage that is already running: elapsed time is known
 * during a run where a run's cost is not, so the reason budget is only
 * checked between stages (ADR 0018 decision 7) does not transfer.
 *
 * This is also the only ceiling with any force over an agent that
 * reports no usage, which is six of the ten this project supports — see
 * LIMITS.md, "Which agents report usage".
 *
 * Absent means unbounded, as every configuration written before these
 * fields existed already means. */
export interface HarnessTimeout {
  /** Ceiling on the time a chain's stages spend, summed. Time spent
   * waiting at a checkpoint for a person is not counted — see
   * `run-has-a-time-limit`'s design.md, "the clock runs while the agent
   * runs". */
  maxRunSeconds?: number;
  /** Ceiling on one stage. This is the one that catches a stage which
   * has stopped making progress; a whole-chain ceiling cannot tell that
   * apart from a chain doing a lot of work. */
  maxStageSeconds?: number;
}

export interface HarnessGitStageAllowlist {
  remotes: string[];
  branches: string[];
}

export interface HarnessConfig {
  stepAgents: HarnessStepAgents;
  autonomyLevel: HarnessAutonomyLevel;
  reviewGate: HarnessReviewGate;
  /** Whether `HarnessChainRunner` pauses for an explicit human
   * confirmation between stages. Optional: absent (the common case) means
   * "confirmation required" wherever it matters — see
   * `agentic-harness-autonomy`'s design.md, "Migration". Only a per-change
   * `harness.json` may set `requireConfirmationBetweenSteps: false`; see
   * `GlobalCheckpointsDisabledError`. */
  checkpoints?: HarnessCheckpoints;
  /** Absent means unlimited — matches every config written before this
   * field existed. A per-change `harness.json` may set a ceiling higher
   * than the global one; unlike `autonomyLevel`/`reviewGate.mode`/
   * `checkpoints`, there is no value a global file is forbidden from
   * setting here — see this file's `assertValidBudget` for why a
   * `GlobalBudgetError`-style check does not apply to a plain numeric
   * ceiling the way it does to those three. */
  budget?: HarnessBudget;
  /** Absent means unbounded — see `HarnessTimeout`. Follows `budget`'s
   * rules: a per-change file may set one where the global file does not,
   * and there is no value a global file is forbidden from setting. */
  timeout?: HarnessTimeout;
  /** How many times one stage may be attempted, counting the first.
   * Absent means one — today's behaviour, where a stage runs once.
   *
   * Deliberately one number covering every reason a stage is attempted
   * again, rather than one per reason: a ceiling of three for a time cut
   * and three for a later retry-on-unchecked would multiply into nine
   * runs of a stage nobody configured. Each attempt records its own
   * reason instead. */
  maxStageAttempts?: number;
  /** Allowlist that gates git-stage push/PR/merge actions. Per-change
   * only: the global `openspec/agent-harness.json` may not set this.
   * `remotes`/`branches` are simple wildcard patterns (`*` supported).
   * An action that does not match is blocked before any `git`/`gh` call. */
  gitStageAllowlist?: HarnessGitStageAllowlist;
}

/** The config to use when neither the global nor a per-change file
 * exists — matches spec.md's "Neither file exists" scenario. */
export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  stepAgents: {},
  autonomyLevel: "assisted",
  reviewGate: { mode: "human-required" },
};

const AUTONOMY_LEVELS = HARNESS_AUTONOMY_LEVELS;
const REVIEW_GATE_MODES: readonly HarnessReviewGateMode[] = ["human-required", "agent-sufficient"];
const KNOWN_AGENT_IDS = new Set([...AGENT_REGISTRY.map((agent) => agent.id), VSCODE_CHAT_STEP_AGENT_ID]);
const AGENT_DESCRIPTORS_BY_ID = new Map(AGENT_REGISTRY.map((agent) => [agent.id, agent]));
/** Stages `stepAgents` used to accept an entry for, before each was found
 * to invoke no agent — `archive` (harness-mechanical-checks), then `git`
 * (harness-git-stage-no-agent). A config's on-disk entry for either is
 * dropped rather than rejected — see `dropNoAgentStepAgents` below. One
 * list feeding both that migration and the validation error below it, so
 * the next stage found to invoke no agent is added here once, not in two
 * places that can drift apart — which is how `git` was missed the first
 * time. */
const NO_AGENT_STAGES = ["archive", "git"] as const;
/** The stages `stepAgents` may set — `STAGES` minus `NO_AGENT_STAGES`,
 * which are mechanical/dedicated-sequence stages with nothing for an
 * entry to configure (task 4.1). */
const STEP_AGENT_STAGES: readonly HarnessStepAgentStage[] = STAGES.filter(isHarnessStepAgentStage);
const STEP_BUDGET_KEYS = ["maxCostUsd", "maxAiCredits"] as const;
const GIT_STAGE_ALLOWLIST_KEYS = ["remotes", "branches"] as const;
/** The only keys `assertValidHarnessConfigInput` accepts at the top level
 * of a harness configuration file — the single place that set is written
 * (task 1.2), so a key added to `HarnessConfig` without being added here
 * is refused on every file that uses it rather than silently ignored. */
export const TOP_LEVEL_CONFIG_KEYS = ["stepAgents", "autonomyLevel", "reviewGate", "checkpoints", "budget", "timeout", "maxStageAttempts", "gitStageAllowlist"] as const;

function formatAcceptedKeys(keys: readonly string[]): string {
  return keys.join(", ");
}

function migrateLegacyDispatchInConfig(raw: unknown): { value: unknown; reports: string[] } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { value: raw, reports: [] };

  const reports: string[] = [];
  const rootRecord = raw as Record<string, unknown>;
  const stepAgents = rootRecord.stepAgents;
  if (typeof stepAgents !== "object" || stepAgents === null || Array.isArray(stepAgents)) {
    return { value: raw, reports };
  }

  let anyMigrated = false;
  const migratedStepAgents: Record<string, unknown> = { ...(stepAgents as Record<string, unknown>) };
  for (const [stage, entry] of Object.entries(migratedStepAgents)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const entryRecord = entry as Record<string, unknown>;
    if (!("dispatch" in entryRecord)) continue;
    const dispatch = entryRecord.dispatch;
    if (dispatch === "cli") {
      const { dispatch: _unused, ...rest } = entryRecord;
      migratedStepAgents[stage] = rest;
      anyMigrated = true;
      continue;
    }
    if (dispatch === "vscode-chat") {
      const { dispatch: _unused, ...rest } = entryRecord;
      migratedStepAgents[stage] = { ...rest, agent: VSCODE_CHAT_STEP_AGENT_ID };
      reports.push(`stepAgents.${stage}.dispatch "vscode-chat" was migrated to stepAgents.${stage}.agent "${VSCODE_CHAT_STEP_AGENT_ID}"`);
      anyMigrated = true;
    }
  }

  if (!anyMigrated) return { value: raw, reports };
  return { value: { ...rootRecord, stepAgents: migratedStepAgents }, reports };
}

/** Drops a `stepAgents` entry for any stage in `NO_AGENT_STAGES`, if
 * present, rather than rejecting the file — see design.md, "`stepAgents`
 * narrows; existing configurations are migrated". Each such stage is
 * mechanical or a dedicated non-agent sequence (`HarnessChainRunner`'s
 * `runStage` never looks up an agent for it); a setting that names one
 * there never did anything, so removing it here is silent to every reader
 * except the warning this returns, which `reportDispatchMigration`'s
 * caller surfaces exactly like a legacy `dispatch` migration. One
 * function for every stage in `NO_AGENT_STAGES`, not one per stage — see
 * harness-git-stage-no-agent tasks.md 2.2: two functions doing the same
 * thing to two stage names is how the next one gets forgotten, which is
 * how `git` came to need this change in the first place. */
function dropNoAgentStepAgents(raw: unknown): { value: unknown; reports: string[] } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { value: raw, reports: [] };

  const rootRecord = raw as Record<string, unknown>;
  const stepAgents = rootRecord.stepAgents;
  if (typeof stepAgents !== "object" || stepAgents === null || Array.isArray(stepAgents)) {
    return { value: raw, reports: [] };
  }

  const stepAgentsRecord = stepAgents as Record<string, unknown>;
  const droppedStages = NO_AGENT_STAGES.filter((stage) => stage in stepAgentsRecord);
  if (droppedStages.length === 0) return { value: raw, reports: [] };

  const rest = { ...stepAgentsRecord };
  for (const stage of droppedStages) delete rest[stage];

  return {
    value: { ...rootRecord, stepAgents: rest },
    reports: droppedStages.map(
      (stage) => `stepAgents.${stage} was dropped — "${stage}" is a mechanical stage and never invokes an agent`,
    ),
  };
}

function reportDispatchMigration(filePath: string, reports: readonly string[]): void {
  if (reports.length === 0) return;
  console.warn(`Migrated legacy harness dispatch settings in ${filePath}: ${reports.join("; ")}`);
}

export class InvalidHarnessConfigError extends Error {
  constructor(reason: string) {
    super(`Invalid harness config: ${reason}`);
    this.name = "InvalidHarnessConfigError";
  }
}

/** `reviewGate.mode: "agent-sufficient"` is only ever valid in a
 * per-change file — see spec.md, "reviewGate.mode: 'agent-sufficient' is
 * never a valid global setting". */
export class GlobalAgentSufficientReviewGateError extends InvalidHarnessConfigError {
  constructor() {
    super('reviewGate.mode "agent-sufficient" is only valid in a per-change harness.json, never in the global openspec/agent-harness.json');
    this.name = "GlobalAgentSufficientReviewGateError";
  }
}

/** `autonomyLevel: "autonomous"` is only ever valid in a per-change file —
 * see `agentic-harness-autonomy`'s design.md, "Decisions". Mirrors
 * `GlobalAgentSufficientReviewGateError`'s exact pattern. */
export class GlobalAutonomousAutonomyLevelError extends InvalidHarnessConfigError {
  constructor() {
    super('autonomyLevel "autonomous" is only valid in a per-change harness.json, never in the global openspec/agent-harness.json');
    this.name = "GlobalAutonomousAutonomyLevelError";
  }
}

/** `checkpoints.requireConfirmationBetweenSteps: false` is only ever valid
 * in a per-change file — closes the same class of loophole as
 * `GlobalAutonomousAutonomyLevelError`. */
export class GlobalCheckpointsDisabledError extends InvalidHarnessConfigError {
  constructor() {
    super('checkpoints.requireConfirmationBetweenSteps: false is only valid in a per-change harness.json, never in the global openspec/agent-harness.json');
    this.name = "GlobalCheckpointsDisabledError";
  }
}

/** `gitStageAllowlist` is only ever valid in a per-change file — mirrors
 * the same per-change-only guard pattern as other high-impact settings. */
export class GlobalGitAllowlistError extends InvalidHarnessConfigError {
  constructor() {
    super("gitStageAllowlist is only valid in a per-change harness.json, never in the global openspec/agent-harness.json");
    this.name = "GlobalGitAllowlistError";
  }
}

/** `autonomyLevel` is the value resolved for the same file being
 * validated (its own `autonomyLevel`, or the default when absent) — see
 * design.md, "Validation splits between core and the host": core can
 * only know what this one file declares, not the merged result of a
 * global file plus a per-change override. */
function assertValidStepAgents(value: unknown, autonomyLevel: HarnessAutonomyLevel): asserts value is HarnessStepAgents {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidHarnessConfigError("stepAgents must be an object");
  }
  for (const [stage, entry] of Object.entries(value)) {
    if ((NO_AGENT_STAGES as readonly string[]).includes(stage)) {
      throw new InvalidHarnessConfigError(
        `stepAgents.${stage} is not accepted — "${stage}" is a mechanical stage and never invokes an agent`,
      );
    }
    if (!STEP_AGENT_STAGES.includes(stage as HarnessStepAgentStage)) {
      throw new InvalidHarnessConfigError(`unknown stepAgents key "${stage}" (expected one of: ${STEP_AGENT_STAGES.join(", ")})`);
    }

    let agentId: unknown;
    let model: unknown;
    let effort: unknown;
    let budget: unknown;
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      const entryRecord = entry as Record<string, unknown>;
      const unknownEntryKey = Object.keys(entryRecord).find(
        (key) => !(STEP_AGENT_KEYS as readonly string[]).includes(key),
      );
      if (unknownEntryKey !== undefined) {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage} has unknown key "${unknownEntryKey}" (accepted keys: ${formatAcceptedKeys(STEP_AGENT_KEYS)})`,
        );
      }
      agentId = (entry as { agent?: unknown }).agent;
      model = (entry as { model?: unknown }).model;
      effort = (entry as { effort?: unknown }).effort;
      budget = (entry as { budget?: unknown }).budget;
    } else {
      agentId = entry;
    }

    if (typeof agentId !== "string" || agentId.length === 0) {
      throw new InvalidHarnessConfigError(`stepAgents.${stage} must be a non-empty string`);
    }
    if (!KNOWN_AGENT_IDS.has(agentId)) {
      throw new InvalidHarnessConfigError(`stepAgents.${stage} references unknown agent id "${agentId}"`);
    }

    if (agentId === VSCODE_CHAT_STEP_AGENT_ID && autonomyLevel !== "assisted") {
      throw new InvalidHarnessConfigError(
        `stepAgents.${stage} selects agent "${VSCODE_CHAT_STEP_AGENT_ID}", which is only valid under autonomyLevel "assisted" — a chain cannot use it`,
      );
    }

    if (model !== undefined) {
      if (agentId === VSCODE_CHAT_STEP_AGENT_ID) {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage}.model cannot reach anything when agent "${VSCODE_CHAT_STEP_AGENT_ID}" dispatches to VS Code chat`,
        );
      }
      if (typeof model !== "string" || !MODEL_ID_PATTERN.test(model)) {
        throw new InvalidHarnessConfigError(`stepAgents.${stage}.model "${String(model)}" is not a valid model id`);
      }
      if (!AGENT_DESCRIPTORS_BY_ID.get(agentId)?.modelFlag) {
        throw new InvalidHarnessConfigError(`stepAgents.${stage} sets a model, but agent "${agentId}" does not accept one`);
      }
    }

    // Refused, not dropped. A `customAgent` an adapter cannot pass is a
    // setting nothing reads, which is the defect this repository has
    // spent several changes removing. See custom-agents-are-visible.
    const customAgent = (entry as { customAgent?: unknown }).customAgent;
    if (customAgent !== undefined) {
      if (agentId === VSCODE_CHAT_STEP_AGENT_ID) {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage}.customAgent cannot reach anything when agent "${VSCODE_CHAT_STEP_AGENT_ID}" dispatches to VS Code chat`,
        );
      }
      if (typeof customAgent !== "string" || customAgent.trim().length === 0) {
        throw new InvalidHarnessConfigError(`stepAgents.${stage}.customAgent must be a non-empty string`);
      }
      // The same character rule a model id obeys, for the same reason:
      // both reach the CLI as the value of a flag, a change's
      // `harness.json` is repository content, and a value beginning with
      // `-` is one the CLI may read as a second flag. One pattern rather
      // than two, so there is one thing to keep true — see design.md,
      // "One shape rule for every value that reaches argv".
      if (!MODEL_ID_PATTERN.test(customAgent)) {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage}.customAgent "${customAgent}" must not begin with "-" and may contain only ` +
            `letters, digits, ".", "_", ":" and "-"`,
        );
      }
      if (!AGENT_DESCRIPTORS_BY_ID.get(agentId)?.customAgentFlag) {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage} sets a custom agent, but agent "${agentId}" does not accept one`,
        );
      }
    }

    const capabilities: HarnessAgentCapabilities | undefined = HARNESS_AGENT_CAPABILITIES[agentId as string];

    if (effort !== undefined) {
      if (agentId === VSCODE_CHAT_STEP_AGENT_ID) {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage}.effort cannot reach anything when agent "${VSCODE_CHAT_STEP_AGENT_ID}" dispatches to VS Code chat`,
        );
      }
      if (typeof effort !== "string" || !HARNESS_EFFORT_VALUES.includes(effort as HarnessEffort)) {
        throw new InvalidHarnessConfigError(`stepAgents.${stage}.effort must be one of: ${HARNESS_EFFORT_VALUES.join(", ")}`);
      }
      const accepted = capabilities?.effort;
      if (!accepted || accepted.length === 0) {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage} sets effort, but agent "${agentId}" has no command-line reasoning-effort control`,
        );
      }
      if (!accepted.includes(effort as HarnessEffort)) {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage}.effort "${effort}" is not accepted by agent "${agentId}" (accepted: ${accepted.join(", ")})`,
        );
      }
    }

    if (budget !== undefined) {
      if (agentId === VSCODE_CHAT_STEP_AGENT_ID) {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage}.budget cannot reach anything when agent "${VSCODE_CHAT_STEP_AGENT_ID}" dispatches to VS Code chat`,
        );
      }
      if (typeof budget !== "object" || budget === null || Array.isArray(budget)) {
        throw new InvalidHarnessConfigError(`stepAgents.${stage}.budget must be an object`);
      }
      const budgetRecord = budget as Record<string, unknown>;
      const unknownBudgetKey = Object.keys(budgetRecord).find(
        (key) => !(STEP_BUDGET_KEYS as readonly string[]).includes(key),
      );
      if (unknownBudgetKey !== undefined) {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage}.budget has unknown key "${unknownBudgetKey}" (accepted keys: ${formatAcceptedKeys(STEP_BUDGET_KEYS)})`,
        );
      }
      const { maxCostUsd, maxAiCredits } = budget as { maxCostUsd?: unknown; maxAiCredits?: unknown };
      if (maxCostUsd === undefined && maxAiCredits === undefined) {
        throw new InvalidHarnessConfigError(`stepAgents.${stage}.budget must set maxCostUsd or maxAiCredits`);
      }
      if (maxCostUsd !== undefined) {
        if (!(typeof maxCostUsd === "number" && Number.isFinite(maxCostUsd) && maxCostUsd > 0)) {
          throw new InvalidHarnessConfigError(`stepAgents.${stage}.budget.maxCostUsd must be a positive number`);
        }
        if (capabilities?.budgetField !== "maxCostUsd") {
          throw new InvalidHarnessConfigError(
            `stepAgents.${stage} sets budget.maxCostUsd, but agent "${agentId}" does not accept a cost cap in USD`,
          );
        }
      }
      if (maxAiCredits !== undefined) {
        if (!(typeof maxAiCredits === "number" && Number.isInteger(maxAiCredits) && maxAiCredits > 0)) {
          throw new InvalidHarnessConfigError(`stepAgents.${stage}.budget.maxAiCredits must be a positive integer`);
        }
        if (capabilities?.budgetField !== "maxAiCredits") {
          throw new InvalidHarnessConfigError(
            `stepAgents.${stage} sets budget.maxAiCredits, but agent "${agentId}" does not accept a credit cap`,
          );
        }
        if (maxAiCredits < COPILOT_MIN_AI_CREDITS) {
          throw new InvalidHarnessConfigError(
            `stepAgents.${stage}.budget.maxAiCredits must be at least ${COPILOT_MIN_AI_CREDITS} (copilot-cli's own minimum)`,
          );
        }
      }
    }
  }
}

function assertValidAutonomyLevel(
  value: unknown,
  isPerChangeFile: boolean,
): asserts value is HarnessAutonomyLevel | undefined {
  if (value === undefined) return;
  if (typeof value !== "string" || !AUTONOMY_LEVELS.includes(value as HarnessAutonomyLevel)) {
    throw new InvalidHarnessConfigError(`autonomyLevel must be one of: ${AUTONOMY_LEVELS.join(", ")}`);
  }
  if (!isPerChangeFile && value === "autonomous") {
    throw new GlobalAutonomousAutonomyLevelError();
  }
}

function assertValidReviewGate(
  value: unknown,
  isPerChangeFile: boolean,
): asserts value is HarnessReviewGate | undefined {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidHarnessConfigError("reviewGate must be an object");
  }
  const mode = (value as { mode?: unknown }).mode;
  if (typeof mode !== "string" || !REVIEW_GATE_MODES.includes(mode as HarnessReviewGateMode)) {
    throw new InvalidHarnessConfigError(`reviewGate.mode must be one of: ${REVIEW_GATE_MODES.join(", ")}`);
  }
  if (!isPerChangeFile && mode === "agent-sufficient") {
    throw new GlobalAgentSufficientReviewGateError();
  }
}

function assertValidCheckpoints(
  value: unknown,
  isPerChangeFile: boolean,
): asserts value is HarnessCheckpoints | undefined {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidHarnessConfigError("checkpoints must be an object");
  }
  const requireConfirmationBetweenSteps = (value as { requireConfirmationBetweenSteps?: unknown })
    .requireConfirmationBetweenSteps;
  if (typeof requireConfirmationBetweenSteps !== "boolean") {
    throw new InvalidHarnessConfigError("checkpoints.requireConfirmationBetweenSteps must be a boolean");
  }
  if (!isPerChangeFile && requireConfirmationBetweenSteps === false) {
    throw new GlobalCheckpointsDisabledError();
  }
}

/** Structural validation only — a positive finite number for each field
 * that is present. Unlike `assertValidAutonomyLevel`/`assertValidReviewGate`/
 * `assertValidCheckpoints`, this takes no `isPerChangeFile` parameter and
 * gates nothing based on it: those three each forbid one specific,
 * categorical VALUE ("autonomous", "agent-sufficient", `false`) in the
 * global file, a check this module can make from one file's own content
 * alone. Task 8.2's "a per-change value may raise the global ceiling"
 * (accepted) and "the global file may not set a value that raises a
 * per-change one" describe a relationship BETWEEN two files' numbers —
 * `mergeHarnessConfig` below already guarantees it structurally (a
 * per-change `budget`, when set, always wins over the global one
 * unconditionally, so the global file can never raise, lower, or
 * otherwise affect a per-change value that was actually set — see this
 * file's own earlier note, "core can only know what this one file
 * declares, not the merged result"), so there is no reachable state here
 * for a `GlobalBudgetError`-style rejection to guard against, and this
 * project's own rule against validating scenarios that cannot happen
 * (CLAUDE.md) argues against inventing one. */
function assertValidBudget(value: unknown): asserts value is HarnessBudget | undefined {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidHarnessConfigError("budget must be an object");
  }
  const { maxCostUsd, maxTokens } = value as { maxCostUsd?: unknown; maxTokens?: unknown };
  if (maxCostUsd !== undefined && !(typeof maxCostUsd === "number" && Number.isFinite(maxCostUsd) && maxCostUsd > 0)) {
    throw new InvalidHarnessConfigError("budget.maxCostUsd must be a positive number");
  }
  if (maxTokens !== undefined && !(typeof maxTokens === "number" && Number.isInteger(maxTokens) && maxTokens > 0)) {
    throw new InvalidHarnessConfigError("budget.maxTokens must be a positive integer");
  }
  const { maxStageCostUsd, maxStageTokens } = value as { maxStageCostUsd?: unknown; maxStageTokens?: unknown };
  if (maxStageCostUsd !== undefined
    && !(typeof maxStageCostUsd === "number" && Number.isFinite(maxStageCostUsd) && maxStageCostUsd > 0)) {
    throw new InvalidHarnessConfigError("budget.maxStageCostUsd must be a positive number");
  }
  if (maxStageTokens !== undefined
    && !(typeof maxStageTokens === "number" && Number.isInteger(maxStageTokens) && maxStageTokens > 0)) {
    throw new InvalidHarnessConfigError("budget.maxStageTokens must be a positive integer");
  }
  // A stage ceiling above the whole-chain ceiling can never fire: the
  // chain ceiling stops the run first. Refused here for the same reason
  // `timeout` refuses the same shape — a setting that cannot fire is a
  // setting that lies about what bounds the run.
  if (typeof maxCostUsd === "number" && typeof maxStageCostUsd === "number" && maxStageCostUsd > maxCostUsd) {
    throw new InvalidHarnessConfigError(
      `budget.maxStageCostUsd (${maxStageCostUsd}) must not exceed budget.maxCostUsd (${maxCostUsd}),`
      + " because the chain ceiling would stop the run first and the stage ceiling could never fire",
    );
  }
  if (typeof maxTokens === "number" && typeof maxStageTokens === "number" && maxStageTokens > maxTokens) {
    throw new InvalidHarnessConfigError(
      `budget.maxStageTokens (${maxStageTokens}) must not exceed budget.maxTokens (${maxTokens}),`
      + " because the chain ceiling would stop the run first and the stage ceiling could never fire",
    );
  }
}

function assertValidTimeout(value: unknown): asserts value is HarnessTimeout | undefined {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidHarnessConfigError("timeout must be an object");
  }
  const { maxRunSeconds, maxStageSeconds } = value as { maxRunSeconds?: unknown; maxStageSeconds?: unknown };
  for (const [key, seconds] of [["maxRunSeconds", maxRunSeconds], ["maxStageSeconds", maxStageSeconds]] as const) {
    if (seconds === undefined) continue;
    if (!(typeof seconds === "number" && Number.isInteger(seconds) && seconds > 0)) {
      throw new InvalidHarnessConfigError(`timeout.${key} must be a positive integer number of seconds`);
    }
  }
  // A stage ceiling above the run ceiling can never fire — the run
  // ceiling stops the chain first — and a setting that cannot fire is a
  // setting that lies about what bounds the run.
  if (
    typeof maxRunSeconds === "number"
    && typeof maxStageSeconds === "number"
    && maxStageSeconds > maxRunSeconds
  ) {
    throw new InvalidHarnessConfigError(
      `timeout.maxStageSeconds (${maxStageSeconds}) must not exceed timeout.maxRunSeconds (${maxRunSeconds}),`
      + " because the run ceiling would stop the chain first and the stage ceiling could never fire",
    );
  }
}

function assertValidMaxStageAttempts(value: unknown): asserts value is number | undefined {
  if (value === undefined) return;
  if (!(typeof value === "number" && Number.isInteger(value) && value > 0)) {
    throw new InvalidHarnessConfigError("maxStageAttempts must be a positive integer");
  }
}

function assertValidGitStageAllowlist(
  value: unknown,
  isPerChangeFile: boolean,
): asserts value is HarnessGitStageAllowlist | undefined {
  if (value === undefined) return;
  if (!isPerChangeFile) {
    throw new GlobalGitAllowlistError();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidHarnessConfigError("gitStageAllowlist must be an object");
  }

  const record = value as Record<string, unknown>;
  const unknownKey = Object.keys(record).find((key) => !(GIT_STAGE_ALLOWLIST_KEYS as readonly string[]).includes(key));
  if (unknownKey !== undefined) {
    throw new InvalidHarnessConfigError(
      `gitStageAllowlist has unknown key "${unknownKey}" (accepted keys: ${formatAcceptedKeys(GIT_STAGE_ALLOWLIST_KEYS)})`,
    );
  }

  const remotes = record.remotes;
  const branches = record.branches;
  if (!Array.isArray(remotes) || remotes.length === 0 || remotes.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new InvalidHarnessConfigError("gitStageAllowlist.remotes must be a non-empty string array");
  }
  if (!Array.isArray(branches) || branches.length === 0 || branches.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new InvalidHarnessConfigError("gitStageAllowlist.branches must be a non-empty string array");
  }
}

/** A top-level key the schema does not define is refused, naming the key
 * and the accepted set — see proposal.md, the `harness-stage-dispatch`
 * file whose `apply` sat at the top level and was silently never read.
 * Runs before the per-key checks below (task 1.4) so a file with both
 * problems reports the unknown key, not a confusing message about a key
 * its author did not mean to write. */
function assertNoUnknownTopLevelKeys(value: Record<string, unknown>): void {
  const unknownKey = Object.keys(value).find((key) => !(TOP_LEVEL_CONFIG_KEYS as readonly string[]).includes(key));
  if (unknownKey === undefined) return;

  // Deliberately does not rewrite the key — see design.md, "No migration,
  // and no guessing". The hint names a possibility, phrased as a
  // question, never an assertion (task 1.6).
  const hint = STAGES.includes(unknownKey as HarnessStage) ? ` Did you mean "stepAgents.${unknownKey}"?` : "";
  throw new InvalidHarnessConfigError(
    `unrecognized top-level key "${unknownKey}" (accepted keys: ${formatAcceptedKeys(TOP_LEVEL_CONFIG_KEYS)}).${hint}`,
  );
}

/** Validates a raw parsed JSON value as a partial `HarnessConfig`.
 * `isPerChangeFile` is `false` for the global file, `true` for a
 * per-change file — gates every field that a global file may not set
 * (`reviewGate.mode: "agent-sufficient"`, `autonomyLevel: "autonomous"`,
 * `checkpoints.requireConfirmationBetweenSteps: false`) — see spec.md. */
function assertValidHarnessConfigInput(
  value: unknown,
  isPerChangeFile: boolean,
): asserts value is Partial<HarnessConfig> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidHarnessConfigError("root value must be an object");
  }
  assertNoUnknownTopLevelKeys(value as Record<string, unknown>);
  const input = value as Partial<HarnessConfig>;
  assertValidAutonomyLevel(input.autonomyLevel, isPerChangeFile);
  assertValidStepAgents(input.stepAgents, input.autonomyLevel ?? DEFAULT_HARNESS_CONFIG.autonomyLevel);
  assertValidReviewGate(input.reviewGate, isPerChangeFile);
  assertValidCheckpoints(input.checkpoints, isPerChangeFile);
  assertValidBudget(input.budget);
  assertValidTimeout(input.timeout);
  assertValidMaxStageAttempts(input.maxStageAttempts);
  assertValidGitStageAllowlist(input.gitStageAllowlist, isPerChangeFile);
}

function globalHarnessConfigPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "openspec", "agent-harness.json");
}

/** The check is here, not in the hosts. Both a REST body and a webview
 * message reach this function with a name they were handed, and
 * `../../../../Users/me/.claude` is a path traversal that writes a
 * `harness.json` outside the workspace. A host that checks and a host
 * that does not are two security models over one function; the function
 * is where the rule is kept. See a-name-is-checked-before-it-is-used.
 *
 * An archived change is named by `location`, never by an `archive/`
 * inside the name — the same split `workbench.ts`'s `changePath` makes,
 * and the reason a change name can stay one path segment with a rule
 * that admits no separator. */
function changeHarnessConfigPath(
  workspaceRoot: string,
  changeName: string,
  location: ChangeLocation = "active",
): string {
  assertValidChangeName(changeName);
  const changesRoot = path.join(workspaceRoot, "openspec", "changes");
  return location === "archive"
    ? path.join(changesRoot, "archive", changeName, "harness.json")
    : path.join(changesRoot, changeName, "harness.json");
}

async function readJsonFile(filePath: string): Promise<unknown | undefined> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
  return JSON.parse(raw);
}

/** Reads `openspec/agent-harness.json`. Returns `DEFAULT_HARNESS_CONFIG`
 * when the file doesn't exist. Throws `InvalidHarnessConfigError` (never
 * silently ignored) if the file is malformed or sets `reviewGate.mode:
 * "agent-sufficient"` at the global level. */
export async function readGlobalHarnessConfig(workspaceRoot: string): Promise<HarnessConfig> {
  const filePath = globalHarnessConfigPath(workspaceRoot);
  const raw = await readJsonFile(filePath);
  if (raw === undefined) return { ...DEFAULT_HARNESS_CONFIG, stepAgents: {} };

  const migrated = migrateLegacyDispatchInConfig(raw);
  const noAgentDropped = dropNoAgentStepAgents(migrated.value);
  reportDispatchMigration(filePath, [...migrated.reports, ...noAgentDropped.reports]);
  assertValidHarnessConfigInput(noAgentDropped.value, false);
  const input = noAgentDropped.value as Partial<HarnessConfig>;
  return {
    stepAgents: input.stepAgents ?? {},
    autonomyLevel: input.autonomyLevel ?? DEFAULT_HARNESS_CONFIG.autonomyLevel,
    reviewGate: input.reviewGate ?? DEFAULT_HARNESS_CONFIG.reviewGate,
    checkpoints: input.checkpoints ?? DEFAULT_HARNESS_CONFIG.checkpoints,
    budget: input.budget ?? DEFAULT_HARNESS_CONFIG.budget,
    // A field added to `HarnessConfig` and to `TOP_LEVEL_CONFIG_KEYS` but
    // not to this list is accepted by validation and then silently
    // dropped on the way out — the file says one thing and the resolved
    // config another. That is how `timeout` first appeared to do nothing
    // at all; the accepted-key list guards writing, nothing guards this.
    timeout: input.timeout ?? DEFAULT_HARNESS_CONFIG.timeout,
    maxStageAttempts: input.maxStageAttempts ?? DEFAULT_HARNESS_CONFIG.maxStageAttempts,
    gitStageAllowlist: input.gitStageAllowlist ?? DEFAULT_HARNESS_CONFIG.gitStageAllowlist,
  };
}

/** Reads `openspec/changes/<changeName>/harness.json`, or the archived
 * change's file when `location` is `"archive"`. Returns `undefined`
 * when the file doesn't exist (distinct from an empty override —
 * callers merge only when this is defined). */
export async function readChangeHarnessConfig(
  workspaceRoot: string,
  changeName: string,
  location: ChangeLocation = "active",
): Promise<Partial<HarnessConfig> | undefined> {
  const filePath = changeHarnessConfigPath(workspaceRoot, changeName, location);
  const raw = await readJsonFile(filePath);
  if (raw === undefined) return undefined;

  const migrated = migrateLegacyDispatchInConfig(raw);
  const noAgentDropped = dropNoAgentStepAgents(migrated.value);
  reportDispatchMigration(filePath, [...migrated.reports, ...noAgentDropped.reports]);
  assertValidHarnessConfigInput(noAgentDropped.value, true);
  return noAgentDropped.value as Partial<HarnessConfig>;
}

/** Deep-merges a per-change override over the global config, key by key
 * (a change overriding only `reviewGate.mode` still inherits every
 * `stepAgents` entry from the global file) — see design.md, "Merge
 * semantics".
 *
 * Each stage entry is merged field by field by `mergeStepAgent`, which
 * lives in `harness-step-agent.ts` beside `STEP_AGENT_KEYS`, the list it
 * is driven by. */
export function mergeHarnessConfig(global: HarnessConfig, override: Partial<HarnessConfig> | undefined): HarnessConfig {
  if (override === undefined) return global;
  return {
    stepAgents: mergeStepAgents(global.stepAgents, override.stepAgents),
    autonomyLevel: override.autonomyLevel ?? global.autonomyLevel,
    reviewGate: override.reviewGate ?? global.reviewGate,
    checkpoints: override.checkpoints ?? global.checkpoints,
    // Whole-object override, like autonomyLevel/reviewGate/checkpoints
    // above — not a key-by-key merge like stepAgents. A per-change budget,
    // when set, is used exactly as declared regardless of whether it is
    // higher or lower than the global one (task 8.2's "a per-change value
    // that is higher than the global ceiling is accepted"); the global
    // file's own budget can never affect a per-change value that was
    // actually set, since `override.budget` wins unconditionally.
    budget: override.budget ?? global.budget,
    // Whole-object override for the same reason as `budget` above: a
    // per-change ceiling is used exactly as declared. Merging key by key
    // would let a global `maxStageSeconds` survive into a per-change
    // `timeout` that deliberately set only `maxRunSeconds`, producing a
    // pair the author never wrote and `assertValidTimeout` never saw.
    timeout: override.timeout ?? global.timeout,
    maxStageAttempts: override.maxStageAttempts ?? global.maxStageAttempts,
    gitStageAllowlist: override.gitStageAllowlist ?? global.gitStageAllowlist,
  };
}

/** Resolves the effective harness config for a workspace, optionally
 * scoped to a specific change. */
export async function resolveHarnessConfig(workspaceRoot: string, changeName?: string): Promise<HarnessConfig> {
  const global = await readGlobalHarnessConfig(workspaceRoot);
  if (changeName === undefined) return global;
  const override = await readChangeHarnessConfig(workspaceRoot, changeName);
  return mergeHarnessConfig(global, override);
}

// resolveRunWithHarnessTarget/RunWithHarnessTarget live in harness-
// dispatch.ts, not here — see that file's header comment for why (a
// value re-export from THIS module would pull its Node-only imports into
// the browser bundle). Re-exported below so a Node-side consumer can
// still get everything from this one module if it prefers.
export { resolveRunWithHarnessTarget, type RunWithHarnessTarget } from "./harness-dispatch.js";

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** Validates before writing — never writes a structurally invalid file
 * (see tasks.md 1.5). */
export async function writeGlobalHarnessConfig(workspaceRoot: string, config: Partial<HarnessConfig>): Promise<void> {
  const migrated = migrateLegacyDispatchInConfig(config);
  assertValidHarnessConfigInput(migrated.value, false);
  await writeJsonFile(globalHarnessConfigPath(workspaceRoot), migrated.value);
}

export async function writeChangeHarnessConfig(
  workspaceRoot: string,
  changeName: string,
  config: Partial<HarnessConfig>,
): Promise<void> {
  const migrated = migrateLegacyDispatchInConfig(config);
  assertValidHarnessConfigInput(migrated.value, true);
  await writeJsonFile(changeHarnessConfigPath(workspaceRoot, changeName), migrated.value);
}
