// Named configurations chosen by the effort they ask for.
//
// Effort is the one dial the product can set honestly: every agent
// declares which values it accepts, so a configuration asking for "the
// highest this agent takes" is always expressible. No agent lists its
// models, so none of these sets one — the model is whichever the
// workspace already configured, and applying a configuration that
// overrode it would discard a choice nobody asked it to make.
//
// The ceilings are still measured and still stated; they are no longer
// the name. A title carrying "$3" was read as a price rather than as the
// point at which a run is stopped. See presets-by-effort, and
// templates-by-cost-and-speed for the axis this replaces.
//
// Every ceiling here comes from this repository's own audit log, read
// through `buildChangeCostReport` on 2026-09-08 — 49 runs with a
// duration (median 7.7 min, p75 19.7, p90 34.9, longest 56.8) and 16
// with a cost (median $1.94, p90 $7.14, largest $8.67). Keep them
// measured: a ten-minute stage ceiling is the round number a person
// reaches for, and it would have cut nearly a third of those runs.
//
// Every template is asserted to produce no findings from
// `findHarnessConfigLimits`. That check is what separates a template
// from a suggestion — shipping a named configuration whose ceiling
// cannot act would publish, in the product's own voice, the confusion
// that diagnostic exists to report.

import type { HarnessConfig } from "./harness-config.js";
import { resolveEffortLevel, type HarnessEffortLevel } from "./harness-effort-level.js";
import { mergeStepAgents, normalizeStepAgent, type HarnessStepAgent, type HarnessStepAgents, type HarnessStepAgentStage } from "./harness-step-agent.js";

/** Where a template may be applied.
 *
 * `autonomyLevel: "autonomous"`, `reviewGate.mode: "agent-sufficient"`
 * and `checkpoints.requireConfirmationBetweenSteps: false` are refused in
 * a global file, so a template using any of them is per-change only.
 * Dropping those fields silently for a global apply would give a person a
 * template that behaves differently depending on where they clicked. */
export type HarnessTemplateScope = "global" | "change" | "either";

export interface HarnessTemplate {
  id: string;
  title: string;
  /** What this is for. */
  intent: string;
  /** When it is the wrong choice — the sentence that actually helps
   * someone pick, since a list of options carrying only advantages gives
   * no help choosing between them. */
  notFor: string;
  /** Where each number came from, so a reader can disagree with the
   * judgement and not with the measurement. */
  basis: string;
  /** Where in the agent's own effort range this sits. Resolved when the
   * configuration is applied, against the agent that stage uses — a
   * stored literal would be wrong for any agent that does not accept it,
   * and `max` is not a value `codex-cli` accepts.
   *
   * The four levels are positions in the range by thirds — 1, 2/3, 1/3,
   * 0 (`harness-effort-level.ts`) — so the words a configuration uses
   * about itself name a position and never a synonym. "The middle of
   * this agent's range" was a third of the way up, which for
   * `copilot-cli` is `low`, the third of seven. */
  effortLevel: HarnessEffortLevel;
  scope: HarnessTemplateScope;
  config: Partial<HarnessConfig>;
}

export const HARNESS_TEMPLATES: readonly HarnessTemplate[] = [
  {
    id: "thorough",
    title: "Thorough",
    effortLevel: "highest",
    intent:
      "The most careful work this agent can do. Highest effort on every stage, with ceilings"
      + " wide enough that it is not cut off part-way.",
    notFor:
      "Ordinary work. It costs the most and it is not faster; the effort buys care, which a"
      + " small or well-understood change does not need.",
    basis:
      "Sets no model — whichever you have configured is the one that runs. Effort is the only"
      + " dial the product can set honestly: every agent declares which values it accepts, and"
      + " no agent lists its models. Ceilings: stage 60 minutes is above the longest run"
      + " measured (56.8); four hours and $25 are judgement, roughly three p90 runs.",
    scope: "either",
    config: {
      autonomyLevel: "semi-autonomous",
      reviewGate: { mode: "human-required" },
      budget: { maxCostUsd: 25, maxStageCostUsd: 10 },
      timeout: { maxRunSeconds: 14400, maxStageSeconds: 3600 },
      maxStageAttempts: 3,
    },
  },
  {
    id: "careful",
    title: "Careful",
    effortLevel: "high",
    intent:
      "Two thirds of the way up this agent's range, with room to finish. For work you want done"
      + " properly but do not need the most expensive setting for.",
    notFor:
      "A change that has already failed twice. More effort at the same approach is not what"
      + " that needs.",
    basis:
      "Sets no model. Stage ceiling 60 minutes is above the longest run measured (56.8); run"
      + " ceiling 2 hours and $10 are judgement, between Thorough and Balanced.",
    scope: "either",
    config: {
      autonomyLevel: "semi-autonomous",
      reviewGate: { mode: "human-required" },
      budget: { maxCostUsd: 10, maxStageCostUsd: 5 },
      timeout: { maxRunSeconds: 7200, maxStageSeconds: 3600 },
      maxStageAttempts: 2,
    },
  },
  {
    id: "balanced",
    title: "Balanced",
    effortLevel: "medium",
    intent:
      "A third of the way up this agent's range, with ceilings close to what an ordinary change"
      + " here actually costs.",
    notFor:
      "Work you cannot afford to have cut short. Its stage ceiling sits at p75, so it stops"
      + " the slowest quarter of runs.",
    basis:
      "Sets no model. Stage ceiling 20 minutes is p75 of measured runs — it cuts the slowest"
      + " quarter. Run ceiling 60 minutes and $5 are judgement: above the median run, below"
      + " p90 of $7.14.",
    scope: "either",
    config: {
      autonomyLevel: "semi-autonomous",
      reviewGate: { mode: "human-required" },
      budget: { maxCostUsd: 5, maxStageCostUsd: 3 },
      timeout: { maxRunSeconds: 3600, maxStageSeconds: 1200 },
      maxStageAttempts: 2,
    },
  },
  {
    id: "economy",
    title: "Economy",
    effortLevel: "lowest",
    intent:
      "The least this agent will do, with the tightest ceilings. For small or repetitive work"
      + " where care is not what is missing.",
    notFor:
      "Work that has already failed once. The lowest effort needs a second attempt more often,"
      + " and two attempts cost more than one at a higher setting.",
    basis:
      "Sets no model. $3 is above the measured median cost of $1.94 and well under p90 of"
      + " $7.14. Stage ceiling 20 minutes is p75; run ceiling 45 minutes is judgement.",
    scope: "either",
    config: {
      autonomyLevel: "semi-autonomous",
      reviewGate: { mode: "human-required" },
      budget: { maxCostUsd: 3, maxStageCostUsd: 2 },
      timeout: { maxRunSeconds: 2700, maxStageSeconds: 1200 },
      maxStageAttempts: 2,
    },
  },
];

/** The templates that may be written to the given file. A per-change-only
 * template is not offered globally, because the write would be refused. */
export function templatesForScope(scope: "global" | "change"): readonly HarnessTemplate[] {
  return HARNESS_TEMPLATES.filter((template) => template.scope === scope || template.scope === "either");
}

/** What a named configuration would set for each stage, given the agents
 * a workspace has configured.
 *
 * The configuration itself carries no `stepAgents`: the agent and the
 * model are the workspace's, and only the effort is the configuration's.
 * Resolving here rather than storing a value is what lets one
 * configuration mean the right thing for an agent accepting seven values
 * and for one accepting four. See presets-by-effort. */
export function stepAgentsForTemplate(
  template: HarnessTemplate,
  configured: HarnessStepAgents,
): HarnessStepAgents {
  const result: HarnessStepAgents = {};
  for (const [stage, entry] of Object.entries(configured) as Array<[HarnessStepAgentStage, HarnessStepAgent]>) {
    const { agent } = normalizeStepAgent(entry);
    const { effort } = resolveEffortLevel(agent, template.effortLevel);
    // An agent accepting no effort keeps its entry untouched rather than
    // gaining an empty one: five of the ten registered accept none, and
    // for them these configurations differ only in their ceilings.
    if (effort === undefined) continue;
    result[stage] = { agent, effort };
  }
  return result;
}

/** The configuration to write when a named configuration is applied to a
 * change: what the change already had, with the configuration laid over
 * it and the effort resolved for the agent each stage actually uses.
 *
 * Both hosts write through this rather than spreading `template.config`
 * themselves. The writer replaces the file, so a key the configuration
 * does not mention — `gitStageAllowlist` above all — would be deleted by
 * applying one, and that is a mistake each host would otherwise have to
 * avoid separately. See applying-a-template-keeps-the-rest.
 *
 * The agent is written beside the effort because an effort without it
 * means nothing: `max` is a value `claude` accepts and `codex` does not.
 * A stage keeping its agent keeps the rest of its entry — its model, its
 * budget, its custom agent — since only the effort was being chosen. */
export function templateConfigToWrite(
  template: HarnessTemplate,
  resolvedStepAgents: HarnessStepAgents,
  existing?: Partial<HarnessConfig>,
): Partial<HarnessConfig> {
  const kept = existing ?? {};
  const applied = stepAgentsForTemplate(template, resolvedStepAgents);
  const stepAgents: HarnessStepAgents = { ...(kept.stepAgents ?? {}) };
  for (const [stage, entry] of Object.entries(applied) as Array<[HarnessStepAgentStage, HarnessStepAgent]>) {
    const previous = stepAgents[stage];
    const before = previous === undefined ? undefined : normalizeStepAgent(previous);
    const next = normalizeStepAgent(entry);
    // Each half stripped before the merge, not after: an absent field
    // arrives as an explicit `undefined`, and spreading that over a
    // value the stage already had would drop it.
    stepAgents[stage] = before?.agent === next.agent
      ? { ...withoutUndefined(before), ...withoutUndefined(next) }
      : withoutUndefined(next);
  }
  return {
    ...kept,
    ...template.config,
    ...(Object.keys(stepAgents).length > 0 ? { stepAgents } : {}),
  };
}

/** The override to write when a named configuration is applied to one
 * change — the single function every surface applies one through.
 *
 * A configuration's effort belongs to the agent the stage will actually
 * run, and for a stage the change does not name that agent comes from
 * the base file. Resolving against the override on its own gives every
 * inherited stage no effort at all, which is what the settings view did
 * while the run dialog resolved against the merged configuration: two
 * surfaces, one change, one named configuration, and two different
 * files. Merging here rather than at each caller leaves that divergence
 * nowhere to live. See a-stage-override-keeps-its-custom-agent.
 *
 * `base` is the global `openspec/agent-harness.json`. `override` is the
 * change's own `harness.json`, or `undefined` when it has none — and
 * what comes back is a whole override file, since the writer replaces
 * it. */
export function changeTemplateConfigToWrite(
  template: HarnessTemplate,
  base: HarnessConfig,
  override: Partial<HarnessConfig> | undefined,
): Partial<HarnessConfig> {
  return templateConfigToWrite(
    template,
    mergeStepAgents(base.stepAgents, override?.stepAgents),
    override ?? {},
  );
}

/** `normalizeStepAgent` fills every field, absent ones as `undefined`.
 * Writing those through would put explicit nulls into a file a person
 * reads. */
function withoutUndefined<T extends object>(entry: T): T {
  return Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined)) as T;
}
