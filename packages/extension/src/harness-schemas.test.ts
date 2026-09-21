import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Ajv from "ajv";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  AGENT_REGISTRY,
  HARNESS_EFFORT_VALUES,
  TOP_LEVEL_CONFIG_KEYS,
  VSCODE_CHAT_STEP_AGENT_ID,
  harnessConfigJsonSchema,
  writeChangeHarnessConfig,
  writeGlobalHarnessConfig,
  type HarnessConfig,
  type HarnessSchemaScope,
} from "@openspec-ui/core";

// the-harness-schemas-know-every-key. The schemas the editor validates
// `openspec/agent-harness.json` and a change's `harness.json` against are
// built from core. These tests hold three things: the checked-in files
// are that output, every top-level key has an entry, and the schema
// answers as the product's own validator does - for every agent, every
// field an entry may carry, and every rule a global file is held to.
// The validator is the oracle, not a table written here: a table would
// drift the way the schemas did.

// every-varying-check-has-a-budget: each comparison writes a temporary
// file per case through the product's validator, a few hundred in all.
// Measured 2026-09-21 on this machine, idle: 1.0 s for the slower scope,
// 2.4 s for the file. Sized for a loaded runner, not for that.
vi.setConfig({ testTimeout: 30_000 });

const SCHEMA_FILES: Record<HarnessSchemaScope, string> = {
  global: "agent-harness.schema.json",
  change: "change-harness.schema.json",
};

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function checkedIn(scope: HarnessSchemaScope): Promise<string> {
  return readFile(path.join(__dirname, "..", "schemas", SCHEMA_FILES[scope]), "utf8");
}

function validatorFor(scope: HarnessSchemaScope) {
  return new Ajv({ allErrors: true }).compile(harnessConfigJsonSchema(scope));
}

/** What the product says of a file: the same check that runs before one is
 * written. */
async function productAccepts(scope: HarnessSchemaScope, config: unknown): Promise<boolean> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-schema-"));
  roots.push(root);
  try {
    if (scope === "global") await writeGlobalHarnessConfig(root, config as Partial<HarnessConfig>);
    else await writeChangeHarnessConfig(root, "demo", config as Partial<HarnessConfig>);
    return true;
  } catch {
    return false;
  }
}

interface Case { name: string; config: Record<string, unknown> }

/** Every field an entry may carry, on every agent: what the validator
 * decides from the agent's own flags and capabilities. */
function entryCases(): Case[] {
  const cases: Case[] = [];
  const agents = [...AGENT_REGISTRY.map((agent) => agent.id), VSCODE_CHAT_STEP_AGENT_ID];
  const fields: Array<[string, Record<string, unknown>]> = [
    ["bare", {}],
    ["model", { model: "some-model-1" }],
    ["model that reads as a flag", { model: "-rf" }],
    ["customAgent", { customAgent: "reviewer" }],
    ["budget in dollars", { budget: { maxCostUsd: 5 } }],
    ["budget in credits", { budget: { maxAiCredits: 40 } }],
    ["budget under the credit minimum", { budget: { maxAiCredits: 10 } }],
    ["empty budget", { budget: {} }],
    ["unknown entry key", { temperature: 1 }],
    ...HARNESS_EFFORT_VALUES.map((effort): [string, Record<string, unknown>] => [`effort ${effort}`, { effort }]),
  ];
  for (const agent of agents) {
    cases.push({ name: `${agent} as a bare string`, config: { stepAgents: { apply: agent } } });
    for (const [label, extra] of fields) {
      cases.push({ name: `${agent} with ${label}`, config: { stepAgents: { apply: { agent, ...extra } } } });
    }
  }
  return cases;
}

function ruleCases(): Case[] {
  return [
    { name: "nothing", config: {} },
    { name: "an unknown top-level key", config: { nonsense: 1 } },
    { name: "an unknown agent", config: { stepAgents: { propose: "nobody-cli" } } },
    { name: "a stage that runs no agent", config: { stepAgents: { archive: "claude-cli" } } },
    { name: "an unknown stage", config: { stepAgents: { deploy: "claude-cli" } } },
    { name: "autonomous", config: { autonomyLevel: "autonomous" } },
    { name: "semi-autonomous", config: { autonomyLevel: "semi-autonomous" } },
    { name: "agent-sufficient", config: { reviewGate: { mode: "agent-sufficient" } } },
    { name: "a review gate with no mode", config: { reviewGate: {} } },
    { name: "checkpoints off", config: { checkpoints: { requireConfirmationBetweenSteps: false } } },
    { name: "vscode-chat, assisted", config: { autonomyLevel: "assisted", stepAgents: { propose: VSCODE_CHAT_STEP_AGENT_ID } } },
    { name: "vscode-chat, semi-autonomous", config: { autonomyLevel: "semi-autonomous", stepAgents: { propose: VSCODE_CHAT_STEP_AGENT_ID } } },
    { name: "vscode-chat as an object, autonomous", config: { autonomyLevel: "autonomous", stepAgents: { propose: { agent: VSCODE_CHAT_STEP_AGENT_ID } } } },
    { name: "every budget field", config: { budget: { maxCostUsd: 25, maxTokens: 1000000, maxCost: { credits: 500 }, maxStageCostUsd: 5, maxStageTokens: 1000 } } },
    { name: "a zero ceiling", config: { budget: { maxCostUsd: 0 } } },
    { name: "tokens that are not whole", config: { budget: { maxTokens: 1.5 } } },
    { name: "a ceiling under an empty unit", config: { budget: { maxCost: { "": 5 } } } },
    { name: "a ceiling under a blank unit", config: { budget: { maxCost: { " ": 5 } } } },
    { name: "a zero ceiling in a unit", config: { budget: { maxCost: { credits: 0 } } } },
    { name: "both time ceilings", config: { timeout: { maxRunSeconds: 3600, maxStageSeconds: 600 } } },
    { name: "seconds that are not whole", config: { timeout: { maxStageSeconds: 1.5 } } },
    { name: "one attempt", config: { maxStageAttempts: 1 } },
    { name: "no attempts", config: { maxStageAttempts: 0 } },
    { name: "hints off", config: { hints: { enabled: false } } },
    { name: "hints with no switch", config: { hints: {} } },
    { name: "agent messages allowed", config: { allowAgentMessages: true } },
    { name: "agent messages as text", config: { allowAgentMessages: "yes" } },
    { name: "rebase off", config: { branches: { rebaseWhenBehind: false } } },
    { name: "main not followed", config: { branches: { followMain: false } } },
    { name: "main followed as text", config: { branches: { followMain: "yes" } } },
    { name: "an unknown branches key", config: { branches: { mergeWhenBehind: true } } },
    { name: "archive off", config: { archive: { whenLanded: false } } },
    { name: "an unknown archive key", config: { archive: { whenMerged: true } } },
    { name: "a git allowlist", config: { gitStageAllowlist: { remotes: ["origin"], branches: ["feature/*"] } } },
    { name: "a git allowlist with no remotes", config: { gitStageAllowlist: { remotes: [], branches: ["main"] } } },
    { name: "a task agent", config: { taskAgents: { "5.4": { agent: "claude-cli", customAgent: "reviewer" } } } },
    { name: "a task agent under a phrase", config: { taskAgents: { "the tests": "claude-cli" } } },
    { name: "vscode-chat for a task", config: { taskAgents: { "5.4": VSCODE_CHAT_STEP_AGENT_ID } } },
    { name: "a step", config: { steps: [{ step: "await-change", before: "verify", param: "other", maxWaitSeconds: 600 }] } },
    { name: "a step placed both ways", config: { steps: [{ step: "await-change", before: "verify", after: "apply", param: "other" }] } },
    { name: "a step placed nowhere", config: { steps: [{ step: "await-change", param: "other" }] } },
    { name: "a step before no stage", config: { steps: [{ step: "await-change", before: "lunch", param: "other" }] } },
    { name: "a step with no change to wait on", config: { steps: [{ step: "await-change", after: "apply" }] } },
    { name: "an unknown step", config: { steps: [{ step: "deploy", after: "apply" }] } },
    { name: "a step with an unknown key", config: { steps: [{ step: "await-change", after: "apply", param: "x", when: "now" }] } },
  ];
}

/** Where the schema knowingly answers otherwise, and why. Each is
 * asserted as a difference, so one that stops being one is noticed. */
const KNOWN_DIFFERENCES: Array<{ name: string; config: Record<string, unknown>; productAccepts: boolean; why: string }> = [
  {
    name: "a stage ceiling above the chain's",
    config: { budget: { maxCostUsd: 5, maxStageCostUsd: 10 } },
    productAccepts: false,
    why: "a relation between two numbers is beyond a JSON Schema",
  },
  {
    name: "a stage time above the run's",
    config: { timeout: { maxRunSeconds: 60, maxStageSeconds: 600 } },
    productAccepts: false,
    why: "a relation between two numbers is beyond a JSON Schema",
  },
  {
    name: "an unknown budget key",
    config: { budget: { maxCostUsd: 5, maxDollars: 3 } },
    productAccepts: true,
    why: "the product reads the budget and ignores the key; the editor says so",
  },
  {
    name: "an unknown timeout key",
    config: { timeout: { maxMinutes: 3 } },
    productAccepts: true,
    why: "the product reads the timeout and ignores the key; the editor says so",
  },
];

describe("the harness schemas", () => {
  for (const scope of ["global", "change"] as const) {
    it(`are what core builds (${scope})`, async () => {
      // Out of date? npm run schemas --workspace packages/extension
      const built = JSON.stringify(harnessConfigJsonSchema(scope), null, 2) + String.fromCharCode(10);
      expect((await checkedIn(scope)).replace(/\r/gu, "")).toBe(built);
    });

    it(`have an entry for every top-level key the product takes (${scope})`, () => {
      const properties = harnessConfigJsonSchema(scope).properties as Record<string, unknown>;
      expect(Object.keys(properties).sort()).toEqual([...TOP_LEVEL_CONFIG_KEYS].sort());
    });

    it(`answer as the product does, for every agent's every field (${scope})`, async () => {
      const validate = validatorFor(scope);
      const disagreements: string[] = [];
      const answers = { accepted: 0, refused: 0 };
      for (const { name, config } of [...entryCases(), ...ruleCases()]) {
        const product = await productAccepts(scope, config);
        const schema = validate(config) === true;
        answers[product ? "accepted" : "refused"] += 1;
        if (product !== schema) disagreements.push(`${name}: the product ${product ? "accepts" : "refuses"}, the schema ${schema ? "accepts" : "refuses"}`);
      }
      expect(disagreements).toEqual([]);
      // A comparison where everything passed, or everything failed, would
      // agree with any schema at all.
      expect(answers.accepted).toBeGreaterThan(30);
      expect(answers.refused).toBeGreaterThan(30);
    });

    it(`differ from the product only where it is written down (${scope})`, async () => {
      const validate = validatorFor(scope);
      for (const difference of KNOWN_DIFFERENCES) {
        expect({ name: difference.name, product: await productAccepts(scope, difference.config) })
          .toEqual({ name: difference.name, product: difference.productAccepts });
        expect({ name: difference.name, schema: validate(difference.config) === true })
          .toEqual({ name: difference.name, schema: !difference.productAccepts });
      }
    });
  }
});
