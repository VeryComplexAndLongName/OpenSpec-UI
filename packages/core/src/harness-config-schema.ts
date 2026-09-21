// The JSON Schemas an editor validates a harness file against, built from
// the same lists `harness-config.ts` enforces
// (the-harness-schemas-know-every-key).
//
// They were written by hand once and never again: by 2026-09-21 they knew
// four of the fourteen top-level keys and forbade the rest, so an editor
// marked `budget`, `timeout`, `branches` and every later key as an error
// in a file the product reads without complaint. Built here, a key added
// to the configuration reaches the schema with nothing to remember, and a
// test in the extension compares the checked-in files with this output.
//
// A schema can say less than the validator - a relation between two
// numbers, such as a stage ceiling above the chain's, is beyond it - but
// it must never refuse a file the validator accepts, beyond marking a key
// inside an object that the product would read and ignore. The same test
// holds it to that with every sample the validator's own tests accept.

import { AGENT_REGISTRY } from "./agents/registry.js";
import { CHAIN_STEPS_REQUIRING_PARAM } from "./chain-steps.js";
import { TOP_LEVEL_CONFIG_KEYS } from "./harness-config.js";
import { CHAIN_STEP_NAMES, STAGES } from "./harness-stage.js";
import {
  COPILOT_MIN_AI_CREDITS,
  HARNESS_AGENT_CAPABILITIES,
  HARNESS_AUTONOMY_LEVELS,
  HARNESS_EFFORT_VALUES,
  MODEL_ID_PATTERN,
  TASK_NUMBER_PATTERN,
  VSCODE_CHAT_STEP_AGENT_ID,
  isHarnessStepAgentStage,
} from "./harness-step-agent.js";

export type HarnessSchemaScope = "global" | "change";

type Schema = Record<string, unknown>;

const NEVER: Schema = { not: {} };

function positiveNumber(description: string): Schema {
  return { type: "number", exclusiveMinimum: 0, description };
}

function positiveInteger(description: string): Schema {
  return { type: "integer", minimum: 1, description };
}

/** Only in a change's own file: in the global one, present and refused,
 * so the editor says why rather than calling the key unknown. */
function perChangeOnly(scope: HarnessSchemaScope, schema: Schema, why: string): Schema {
  return scope === "change" ? schema : { ...NEVER, description: `Only a change's own harness.json may set this. ${why}` };
}

function agentIds(): string[] {
  return [...AGENT_REGISTRY.map((agent) => agent.id), VSCODE_CHAT_STEP_AGENT_ID];
}

/** What one agent's entry may carry, as the validator decides it: a model
 * and a custom agent only where the agent takes the flag, an effort only
 * among the values it accepts, a budget only in the unit it caps. */
function entryRulesFor(agentId: string): Schema {
  const descriptor = AGENT_REGISTRY.find((agent) => agent.id === agentId);
  const capabilities = HARNESS_AGENT_CAPABILITIES[agentId] ?? {};
  const properties: Record<string, Schema> = {};
  if (!descriptor?.modelFlag) properties.model = { ...NEVER, description: `${agentId} does not take a model.` };
  if (!descriptor?.customAgentFlag) properties.customAgent = { ...NEVER, description: `${agentId} does not take a custom agent.` };
  const effort = capabilities.effort ?? [];
  properties.effort = effort.length === 0
    ? { ...NEVER, description: `${agentId} has no command-line reasoning-effort control.` }
    : { enum: [...effort], description: `The effort values ${agentId} accepts.` };
  if (capabilities.budgetField === undefined) {
    properties.budget = { ...NEVER, description: `${agentId} has no spending cap of its own.` };
  } else {
    properties.budget = {
      type: "object",
      properties: {
        [capabilities.budgetField === "maxCostUsd" ? "maxAiCredits" : "maxCostUsd"]: {
          ...NEVER,
          description: `${agentId} caps spending in ${capabilities.budgetField} only.`,
        },
      },
    };
  }
  return {
    if: { properties: { agent: { const: agentId } }, required: ["agent"] },
    then: { properties },
  };
}

function definitions(): Record<string, Schema> {
  return {
    agentId: {
      type: "string",
      enum: agentIds(),
      description: "A registered agent id (packages/core/src/agents/registry.ts), or vscode-chat, which hands the stage to VS Code chat.",
    },
    agentEntry: {
      description: "An agent id, or an object naming the agent with what it runs with.",
      oneOf: [
        { $ref: "#/definitions/agentId" },
        {
          type: "object",
          additionalProperties: false,
          required: ["agent"],
          properties: {
            agent: { $ref: "#/definitions/agentId" },
            model: {
              type: "string",
              pattern: MODEL_ID_PATTERN.source,
              description: "The model the agent runs. Only for an agent that takes a model flag.",
            },
            effort: {
              type: "string",
              enum: [...HARNESS_EFFORT_VALUES],
              description: "Reasoning effort. Only the values the chosen agent accepts.",
            },
            budget: {
              type: "object",
              additionalProperties: false,
              minProperties: 1,
              properties: {
                maxCostUsd: positiveNumber("A cap in USD, for an agent that caps spending in dollars."),
                maxAiCredits: {
                  type: "integer",
                  minimum: COPILOT_MIN_AI_CREDITS,
                  description: `A cap in AI credits, at least ${COPILOT_MIN_AI_CREDITS}, for an agent that caps spending in credits.`,
                },
              },
            },
            customAgent: {
              type: "string",
              pattern: MODEL_ID_PATTERN.source,
              description: "A custom agent definition the agent loads. Only for an agent that takes one.",
            },
          },
          allOf: [
            {
              if: { properties: { agent: { const: VSCODE_CHAT_STEP_AGENT_ID } }, required: ["agent"] },
              then: {
                properties: {
                  model: NEVER,
                  effort: NEVER,
                  budget: NEVER,
                  customAgent: NEVER,
                },
              },
            },
            ...AGENT_REGISTRY.map((agent) => entryRulesFor(agent.id)),
          ],
        },
      ],
    },
  };
}

function stepAgents(): Schema {
  const properties: Record<string, Schema> = {};
  for (const stage of STAGES) {
    properties[stage] = isHarnessStepAgentStage(stage)
      ? { $ref: "#/definitions/agentEntry" }
      : { ...NEVER, description: `"${stage}" is a mechanical stage and never invokes an agent.` };
  }
  return {
    type: "object",
    additionalProperties: false,
    properties,
    description: "Which agent runs each stage.",
  };
}

function isVscodeChat(): Schema {
  return {
    anyOf: [
      { const: VSCODE_CHAT_STEP_AGENT_ID },
      { type: "object", properties: { agent: { const: VSCODE_CHAT_STEP_AGENT_ID } }, required: ["agent"] },
    ],
  };
}

function topLevel(scope: HarnessSchemaScope): Record<string, Schema> {
  const autonomyLevels = scope === "global"
    ? HARNESS_AUTONOMY_LEVELS.filter((level) => level !== "autonomous")
    : [...HARNESS_AUTONOMY_LEVELS];
  const properties: Record<string, Schema> = {
    stepAgents: stepAgents(),
    autonomyLevel: {
      type: "string",
      enum: autonomyLevels,
      description: scope === "global"
        ? "How much runs without a person. autonomous is only valid in a change's own harness.json."
        : "How much runs without a person.",
    },
    reviewGate: {
      type: "object",
      additionalProperties: false,
      required: ["mode"],
      properties: {
        mode: {
          type: "string",
          enum: scope === "global" ? ["human-required"] : ["human-required", "agent-sufficient"],
          description: scope === "global"
            ? "agent-sufficient is only valid in a change's own harness.json."
            : "Whether an agent's review is enough to go on.",
        },
      },
    },
    checkpoints: {
      type: "object",
      additionalProperties: false,
      required: ["requireConfirmationBetweenSteps"],
      properties: {
        requireConfirmationBetweenSteps: scope === "global"
          ? { type: "boolean", enum: [true], description: "false is only valid in a change's own harness.json." }
          : { type: "boolean", description: "Whether the chain pauses for a person between stages." },
      },
    },
    budget: {
      type: "object",
      additionalProperties: false,
      description: "Spending ceilings for the chain and for one stage. A stage ceiling above the chain's is refused by the product.",
      properties: {
        maxCostUsd: positiveNumber("The chain's ceiling in USD."),
        maxTokens: positiveInteger("The chain's ceiling in input plus output tokens."),
        maxCost: {
          type: "object",
          description: "The chain's ceiling per unit of account, such as credits: 500.",
          propertyNames: { minLength: 1, pattern: "[^ ]" },
          additionalProperties: positiveNumber("A ceiling in this unit."),
        },
        maxStageCostUsd: positiveNumber("One stage's ceiling in USD, checked when the stage ends."),
        maxStageTokens: positiveInteger("One stage's ceiling in tokens, checked when the stage ends."),
      },
    },
    timeout: {
      type: "object",
      additionalProperties: false,
      description: "Time ceilings in seconds. A stage ceiling above the run's is refused by the product.",
      properties: {
        maxRunSeconds: positiveInteger("The chain's stages, summed."),
        maxStageSeconds: positiveInteger("One stage."),
      },
    },
    maxStageAttempts: positiveInteger("How many times one stage may be attempted, counting the first."),
    gitStageAllowlist: perChangeOnly(scope, {
      type: "object",
      additionalProperties: false,
      required: ["remotes", "branches"],
      description: "Where the git stage may push, open and merge pull requests. Wildcards (*) allowed.",
      properties: {
        remotes: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
        branches: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
      },
    }, "A workspace default must never grant push."),
    taskAgents: perChangeOnly(scope, {
      type: "object",
      description: "Which agent runs one numbered task of this change, keyed by the task's number.",
      propertyNames: { pattern: TASK_NUMBER_PATTERN.source },
      additionalProperties: {
        allOf: [
          { $ref: "#/definitions/agentEntry" },
          { not: isVscodeChat() },
        ],
      },
    }, "The tasks it names are one change's."),
    steps: perChangeOnly(scope, {
      type: "array",
      description: "Steps this change's chain adds, each placed before or after a fixed stage.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["step"],
        properties: {
          step: { type: "string", enum: [...CHAIN_STEP_NAMES] },
          before: { type: "string", enum: [...STAGES] },
          after: { type: "string", enum: [...STAGES] },
          param: { type: "string" },
          maxWaitSeconds: positiveNumber("How long a waiting step may wait."),
        },
        oneOf: [
          { required: ["before"], not: { required: ["after"] } },
          { required: ["after"], not: { required: ["before"] } },
        ],
        allOf: CHAIN_STEPS_REQUIRING_PARAM.map((step) => ({
          if: { properties: { step: { const: step } }, required: ["step"] },
          then: { required: ["param"], properties: { param: { minLength: 1 } } },
        })),
      },
    }, "A chain's steps are one change's."),
    hints: {
      type: "object",
      required: ["enabled"],
      properties: { enabled: { type: "boolean", description: "Whether suggestions are computed at all." } },
    },
    allowAgentMessages: { type: "boolean", description: "Whether a run takes notes written by another run. Absent means false." },
    branches: {
      type: "object",
      additionalProperties: false,
      properties: {
        rebaseWhenBehind: { type: "boolean", description: "Rebase a change's branch that has fallen behind, and push it with a lease (ADR 0034). Absent means true." },
      },
    },
    archive: {
      type: "object",
      additionalProperties: false,
      properties: {
        whenLanded: { type: "boolean", description: "Archive a change that has landed with nothing open, in a pull request that merges on green (ADR 0035). Absent means true." },
      },
    },
  };
  return properties;
}

/** The JSON Schema for the global `openspec/agent-harness.json`, or for a
 * change's own `harness.json`. */
export function harnessConfigJsonSchema(scope: HarnessSchemaScope): Schema {
  const properties = topLevel(scope);
  const missing = TOP_LEVEL_CONFIG_KEYS.filter((key) => !(key in properties));
  if (missing.length > 0) throw new Error(`the harness schema has no entry for ${missing.join(", ")}`);
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $comment: "Generated from packages/core/src/harness-config-schema.ts. Do not edit: run npm run schemas --workspace packages/extension.",
    title: scope === "global"
      ? "OpenSpec Workbench Agentic Harness - global config"
      : "OpenSpec Workbench Agentic Harness - per-change override",
    description: scope === "global"
      ? "openspec/agent-harness.json: the workspace's defaults. See HARNESS.md for every key. autonomous, agent-sufficient and checkpoints turned off are only valid in a change's own harness.json, and gitStageAllowlist, taskAgents and steps only there."
      : "openspec/changes/<id>/harness.json: this change's differences from openspec/agent-harness.json, merged over it. See HARNESS.md for every key.",
    type: "object",
    additionalProperties: false,
    properties,
    // vscode-chat hands a stage to a person's chat, so it only runs where a
    // person drives each stage.
    if: {
      properties: { autonomyLevel: { enum: HARNESS_AUTONOMY_LEVELS.filter((level) => level !== "assisted") } },
      required: ["autonomyLevel"],
    },
    then: {
      properties: {
        stepAgents: { additionalProperties: { not: isVscodeChat() } },
      },
    },
    definitions: definitions(),
  };
}
