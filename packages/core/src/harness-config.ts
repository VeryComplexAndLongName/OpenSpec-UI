import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AGENT_REGISTRY } from "./agents/registry.js";
import { STAGES, type HarnessStage } from "./harness-stage.js";
import {
  MODEL_ID_PATTERN,
  normalizeStepAgent,
  type HarnessStageDispatch,
  type HarnessStepAgent,
  type HarnessStepAgents,
} from "./harness-step-agent.js";

export { STAGES, type HarnessStage };
export { MODEL_ID_PATTERN, normalizeStepAgent, type HarnessStageDispatch, type HarnessStepAgent, type HarnessStepAgents };

// Agentic Harness config — see docs/adr/0011-agentic-harness-config-and-
// autonomy-levels.md and openspec/changes/agentic-harness/. Deliberately
// its own file pair, not new keys inside openspec/config.yaml: the
// upstream openspec CLI's config schema is a fixed Zod object that
// silently drops unrecognized keys (verified in @fission-ai/openspec's
// own source), so anything added there would look configured but do
// nothing.

export type HarnessAutonomyLevel = "assisted" | "semi-autonomous" | "autonomous";
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
}

/** The config to use when neither the global nor a per-change file
 * exists — matches spec.md's "Neither file exists" scenario. */
export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  stepAgents: {},
  autonomyLevel: "assisted",
  reviewGate: { mode: "human-required" },
};

const AUTONOMY_LEVELS: readonly HarnessAutonomyLevel[] = ["assisted", "semi-autonomous", "autonomous"];
const REVIEW_GATE_MODES: readonly HarnessReviewGateMode[] = ["human-required", "agent-sufficient"];
const KNOWN_AGENT_IDS = new Set(AGENT_REGISTRY.map((agent) => agent.id));
const AGENT_DESCRIPTORS_BY_ID = new Map(AGENT_REGISTRY.map((agent) => [agent.id, agent]));

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
    if (!STAGES.includes(stage as HarnessStage)) {
      throw new InvalidHarnessConfigError(`unknown stepAgents key "${stage}" (expected one of: ${STAGES.join(", ")})`);
    }

    let agentId: unknown;
    let model: unknown;
    let dispatch: unknown;
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      agentId = (entry as { agent?: unknown }).agent;
      model = (entry as { model?: unknown }).model;
      dispatch = (entry as { dispatch?: unknown }).dispatch;
    } else {
      agentId = entry;
    }

    if (typeof agentId !== "string" || agentId.length === 0) {
      throw new InvalidHarnessConfigError(`stepAgents.${stage} must be a non-empty string`);
    }
    if (!KNOWN_AGENT_IDS.has(agentId)) {
      throw new InvalidHarnessConfigError(`stepAgents.${stage} references unknown agent id "${agentId}"`);
    }

    if (model !== undefined) {
      if (typeof model !== "string" || !MODEL_ID_PATTERN.test(model)) {
        throw new InvalidHarnessConfigError(`stepAgents.${stage}.model "${String(model)}" is not a valid model id`);
      }
      if (!AGENT_DESCRIPTORS_BY_ID.get(agentId)?.modelFlag) {
        throw new InvalidHarnessConfigError(`stepAgents.${stage} sets a model, but agent "${agentId}" does not accept one`);
      }
    }

    if (dispatch !== undefined) {
      if (dispatch !== "cli" && dispatch !== "vscode-chat") {
        throw new InvalidHarnessConfigError(`stepAgents.${stage}.dispatch must be "cli" or "vscode-chat"`);
      }
      if (dispatch === "vscode-chat" && autonomyLevel !== "assisted") {
        throw new InvalidHarnessConfigError(
          `stepAgents.${stage} sets dispatch "vscode-chat", which is only valid under autonomyLevel "assisted" — a chain cannot use it`,
        );
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
  const input = value as Partial<HarnessConfig>;
  assertValidAutonomyLevel(input.autonomyLevel, isPerChangeFile);
  assertValidStepAgents(input.stepAgents, input.autonomyLevel ?? DEFAULT_HARNESS_CONFIG.autonomyLevel);
  assertValidReviewGate(input.reviewGate, isPerChangeFile);
  assertValidCheckpoints(input.checkpoints, isPerChangeFile);
  assertValidBudget(input.budget);
}

function globalHarnessConfigPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "openspec", "agent-harness.json");
}

function changeHarnessConfigPath(workspaceRoot: string, changeName: string): string {
  return path.join(workspaceRoot, "openspec", "changes", changeName, "harness.json");
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
  const raw = await readJsonFile(globalHarnessConfigPath(workspaceRoot));
  if (raw === undefined) return { ...DEFAULT_HARNESS_CONFIG, stepAgents: {} };

  assertValidHarnessConfigInput(raw, false);
  return {
    stepAgents: raw.stepAgents ?? {},
    autonomyLevel: raw.autonomyLevel ?? DEFAULT_HARNESS_CONFIG.autonomyLevel,
    reviewGate: raw.reviewGate ?? DEFAULT_HARNESS_CONFIG.reviewGate,
    checkpoints: raw.checkpoints ?? DEFAULT_HARNESS_CONFIG.checkpoints,
    budget: raw.budget ?? DEFAULT_HARNESS_CONFIG.budget,
  };
}

/** Reads `openspec/changes/<changeName>/harness.json`. Returns
 * `undefined` when the file doesn't exist (distinct from an empty
 * override — callers merge only when this is defined). */
export async function readChangeHarnessConfig(
  workspaceRoot: string,
  changeName: string,
): Promise<Partial<HarnessConfig> | undefined> {
  const raw = await readJsonFile(changeHarnessConfigPath(workspaceRoot, changeName));
  if (raw === undefined) return undefined;

  assertValidHarnessConfigInput(raw, true);
  return raw;
}

/** Deep-merges a per-change override over the global config, key by key
 * (a change overriding only `reviewGate.mode` still inherits every
 * `stepAgents` entry from the global file) — see design.md, "Merge
 * semantics". */
export function mergeHarnessConfig(global: HarnessConfig, override: Partial<HarnessConfig> | undefined): HarnessConfig {
  if (override === undefined) return global;
  return {
    stepAgents: { ...global.stepAgents, ...override.stepAgents },
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
  assertValidHarnessConfigInput(config, false);
  await writeJsonFile(globalHarnessConfigPath(workspaceRoot), config);
}

export async function writeChangeHarnessConfig(
  workspaceRoot: string,
  changeName: string,
  config: Partial<HarnessConfig>,
): Promise<void> {
  assertValidHarnessConfigInput(config, true);
  await writeJsonFile(changeHarnessConfigPath(workspaceRoot, changeName), config);
}
