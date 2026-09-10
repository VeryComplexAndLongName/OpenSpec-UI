import { describe, expect, it } from "vitest";
import { findHarnessConfigLimits } from "./harness-config-findings.js";
import { DEFAULT_HARNESS_CONFIG, type HarnessConfig } from "./harness-config.js";
import { HARNESS_AGENT_CAPABILITIES, normalizeStepAgent } from "./harness-step-agent.js";
import { HARNESS_EFFORT_LEVELS, resolveEffortLevel } from "./harness-effort-level.js";
import type { HarnessStepAgent, HarnessStepAgents } from "./harness-step-agent.js";
import { changeTemplateConfigToWrite, HARNESS_TEMPLATES, stepAgentsForTemplate, templateConfigToWrite, templatesForScope } from "./harness-templates.js";

// settings-templates:
// pure over in-memory data — no files, no processes. Measured 2026-09-08
// at under 10ms for the whole file.

function resolved(template: Partial<HarnessConfig>): HarnessConfig {
  return { ...DEFAULT_HARNESS_CONFIG, stepAgents: {}, ...template };
}

describe("HARNESS_TEMPLATES", () => {
  // Iterating the list rather than naming each template is what makes it
  // impossible to add one without the check.
  for (const template of HARNESS_TEMPLATES) {
    it(`"${template.id}" contains no ceiling that cannot act`, () => {
      // The check that separates a template from a suggestion: shipping a
      // named configuration whose ceiling cannot act would publish, in
      // the product's own voice, the confusion the diagnostic reports.
      expect(findHarnessConfigLimits(resolved(template.config))).toEqual([]);
    });

    it(`"${template.id}" says what it is for and when it is wrong`, () => {
      // The second sentence is the one that helps: a list of options
      // carrying only advantages gives no help choosing between them.
      expect(template.intent.length).toBeGreaterThan(0);
      expect(template.notFor.length).toBeGreaterThan(0);
      expect(template.basis).toMatch(/measured|median|p75|p90|judgement/);
    });

    it(`"${template.id}" is offered only where it can be written`, () => {
      const usesChangeOnlyField = template.config.autonomyLevel === "autonomous"
        || template.config.reviewGate?.mode === "agent-sufficient"
        || template.config.checkpoints?.requireConfirmationBetweenSteps === false;
      if (usesChangeOnlyField) {
        // A global write of any of these is refused outright, so offering
        // it there would hand someone a template that fails on save.
        expect(template.scope).toBe("change");
      }
    });
  }

  it("offers a per-change-only template for a change and not globally", () => {
    // Named by scope rather than by id: presets-by-effort left every
    // shipped configuration global-safe, and a test naming one id would
    // have had to be deleted rather than kept working.
    const globalIds = templatesForScope("global").map((t) => t.id);
    const changeIds = templatesForScope("change").map((t) => t.id);
    for (const template of HARNESS_TEMPLATES) {
      expect(changeIds).toContain(template.id);
      if (template.scope === "change") expect(globalIds).not.toContain(template.id);
      else expect(globalIds).toContain(template.id);
    }
  });

  it("has distinct ids", () => {
    expect(new Set(HARNESS_TEMPLATES.map((t) => t.id)).size).toBe(HARNESS_TEMPLATES.length);
  });
});

describe("HARNESS_TEMPLATES — the text and the configuration agree", () => {
  // a-template-keeps-its-promises. The unattended template said "No checkpoints between
  // stages" and set no `checkpoints`, so a change configured from it
  // still paused for confirmation between every stage — the one thing an
  // unattended run must not do. Found by applying it and reading the
  // saved file, because nothing compared a template's sentences against
  // what it applies.
  //
  // A template's sentences are its interface. A sentence that is not true
  // is the same defect as a ceiling that cannot act, and harder to
  // notice.

  /** Everything a person reads before applying one. */
  const wordsOf = (template: (typeof HARNESS_TEMPLATES)[number]): string =>
    `${template.title} ${template.intent} ${template.notFor} ${template.basis}`.toLowerCase();

  /** Deliberately narrow. Most of a template's prose cannot be read
   * mechanically; this covers the claims that name a specific setting,
   * which is the class the defect came from. */
  const CLAIMS_NO_CHECKPOINTS = /no checkpoints|without (?:stopping|pausing)|does not pause/;

  for (const template of HARNESS_TEMPLATES) {
    it(`"${template.id}" turns confirmation off if its text says it does not stop`, () => {
      if (!CLAIMS_NO_CHECKPOINTS.test(wordsOf(template))) return;
      expect(template.config.checkpoints?.requireConfirmationBetweenSteps).toBe(false);
    });

    it(`"${template.id}" says so in its text if it turns confirmation off`, () => {
      // The same failure with the halves swapped: a configuration acting
      // in a way the sentences never mentioned.
      if (template.config.checkpoints?.requireConfirmationBetweenSteps !== false) return;
      expect(wordsOf(template)).toMatch(CLAIMS_NO_CHECKPOINTS);
    });
  }
});

describe("HARNESS_TEMPLATES — named by the effort they ask for", () => {
  // presets-by-effort. The figures were in the title, and "$3" was read
  // as what a run costs rather than as the point at which it is stopped.
  // Effort is what the product can set honestly — every agent declares
  // which values it accepts — so it is what the titles name, and the
  // ceilings stay in `basis` with where each figure came from.

  it("names a level for every configuration, and every level once", () => {
    const levels = HARNESS_TEMPLATES.map((template) => template.effortLevel);
    expect(new Set(levels).size).toBe(levels.length);
    expect([...levels].sort()).toEqual([...HARNESS_EFFORT_LEVELS].sort());
  });

  it("runs from the most effort to the least", () => {
    // The order is the axis. A list on an effort axis that does not run
    // in effort order asks the reader to sort it themselves.
    const levels = HARNESS_TEMPLATES.map((template) => template.effortLevel);
    expect(levels).toEqual([...HARNESS_EFFORT_LEVELS]);
  });

  it("gives more room to more effort", () => {
    // The two dials move together, which is what lets a recommendation
    // say "one step roomier" and mean one move.
    const costs = HARNESS_TEMPLATES.map((template) => template.config.budget?.maxCostUsd ?? 0);
    expect(costs).toEqual([...costs].sort((a, b) => b - a));
  });

  for (const template of HARNESS_TEMPLATES) {
    it(`"${template.id}" carries no figure in its title`, () => {
      // The defect this replaces: a ceiling in the name read as a price.
      expect(template.title).not.toMatch(/\$\d/);
      expect(template.title).not.toMatch(/\d+\s*(min|hour)/);
    });

    it(`"${template.id}" states its ceilings and says it sets no model`, () => {
      // Removed from the title, they have to be somewhere a person
      // reads before applying — and the model has to be said rather than
      // inferred from an absence.
      const cost = template.config.budget?.maxCostUsd;
      expect(cost).toBeDefined();
      expect(template.basis).toContain(`$${cost}`);
      expect(template.basis.toLowerCase()).toContain("sets no model");
    });

    it(`"${template.id}" sets no agent and no model`, () => {
      // The whole point: the agent and the model are the workspace's.
      expect(template.config.stepAgents).toBeUndefined();
      expect(JSON.stringify(template.config)).not.toContain("model");
    });
  }
});

describe("HARNESS_TEMPLATES — the words describe the position the resolver produces", () => {
  // a-stage-override-keeps-its-custom-agent. "The middle of this agent's
  // range" was the balanced configuration's own sentence, and the
  // mapping is thirds: for `copilot-cli` the medium level resolves to
  // `low`, the third of seven, which is nowhere near the middle. The
  // arithmetic was decided deliberately (presets-by-effort's design.md
  // carries the table), so the sentence is what was wrong.
  //
  // Checked over every registered agent, because a position claim can be
  // true for one vocabulary and false for another — with five values
  // "the middle" and "a third of the way up" happen to differ by one
  // index, and with seven they differ by two.

  const wordsOf = (template: (typeof HARNESS_TEMPLATES)[number]): string =>
    `${template.title} ${template.intent} ${template.notFor} ${template.basis}`.toLowerCase();

  /** Positional phrases a configuration may use about itself, and the
   * fraction of the agent's range each one claims. Deliberately narrow:
   * most of a template's prose cannot be read mechanically, and this
   * covers the class the defect came from — a word standing in for an
   * index. */
  const POSITION_CLAIMS: ReadonlyArray<{ label: string; pattern: RegExp; fraction: number }> = [
    { label: "the middle", pattern: /\bthe middle\b|\bhalfway\b|\bhalf way\b/, fraction: 0.5 },
    { label: "a third of the way up", pattern: /\ba third of the way up\b/, fraction: 1 / 3 },
    { label: "two thirds of the way up", pattern: /\btwo thirds of the way up\b/, fraction: 2 / 3 },
  ];

  for (const template of HARNESS_TEMPLATES) {
    it(`"${template.id}" claims no position its own level does not resolve to`, () => {
      const words = wordsOf(template);
      const claimed = POSITION_CLAIMS.filter((claim) => claim.pattern.test(words));
      for (const [agent, capabilities] of Object.entries(HARNESS_AGENT_CAPABILITIES)) {
        const accepted = capabilities.effort ?? [];
        // An agent with no vocabulary is told the configurations differ
        // in their ceilings alone; there is no position to be wrong
        // about.
        if (accepted.length === 0) continue;
        const { effort } = resolveEffortLevel(agent, template.effortLevel);
        for (const claim of claimed) {
          expect(
            effort,
            `"${template.id}" says "${claim.label}" and resolves to "${effort}" for ${agent}`,
          ).toBe(accepted[Math.round(claim.fraction * (accepted.length - 1))]);
        }
      }
    });
  }

  it("at least one configuration states its position, so the check has something to read", () => {
    // A guard over prose passes vacuously the moment the prose stops
    // saying anything, and a check that cannot fail is not a check.
    const stating = HARNESS_TEMPLATES.filter((template) =>
      POSITION_CLAIMS.some((claim) => claim.pattern.test(wordsOf(template))));
    expect(stating.length).toBeGreaterThan(0);
  });
});

/** A stage entry may be a bare agent id, so read it the way the runner
 * does rather than reaching for a field the string form does not have. */
const effortOf = (entry: HarnessStepAgent | undefined): string | undefined =>
  entry === undefined ? undefined : normalizeStepAgent(entry).effort;

describe("stepAgentsForTemplate", () => {
  // The value is resolved against the agent the stage uses, because
  // `max` is not a value `codex-cli` accepts and storing a literal would
  // be wrong for some agent the moment it is applied.

  it("resolves one level to each agent's own vocabulary", () => {
    const thorough = HARNESS_TEMPLATES.find((t) => t.effortLevel === "highest");
    expect(thorough).toBeDefined();
    const applied = stepAgentsForTemplate(thorough as (typeof HARNESS_TEMPLATES)[number], {
      propose: { agent: "claude-cli" },
      apply: { agent: "codex-cli" },
    });

    expect(effortOf(applied.propose)).toBe("max");
    expect(effortOf(applied.apply)).toBe("high");
  });

  it("keeps the agent and adds no effort for an agent that accepts none", () => {
    const economy = HARNESS_TEMPLATES.find((t) => t.effortLevel === "lowest");
    const applied = stepAgentsForTemplate(economy as (typeof HARNESS_TEMPLATES)[number], {
      apply: { agent: "vscode-chat" },
    });

    // Not an empty entry: for this agent the configurations differ only
    // in their ceilings, and the surface says so rather than showing a
    // dial that does nothing.
    expect(applied.apply).toBeUndefined();
  });

  it("resolves to a value the agent actually accepts, for every agent and level", () => {
    // presets-by-effort task 5.5. A resolution answering the same thing
    // for every agent is not reading the vocabulary.
    for (const [agent, capabilities] of Object.entries(HARNESS_AGENT_CAPABILITIES)) {
      const accepted = capabilities.effort ?? [];
      for (const template of HARNESS_TEMPLATES) {
        const applied = stepAgentsForTemplate(template, { apply: { agent } });
        if (accepted.length === 0) {
          expect(applied.apply).toBeUndefined();
          continue;
        }
        expect(accepted).toContain(effortOf(applied.apply));
      }
    }
  });

  it("does not answer the same for agents with different vocabularies", () => {
    const thorough = HARNESS_TEMPLATES[0] as (typeof HARNESS_TEMPLATES)[number];
    const claude = stepAgentsForTemplate(thorough, { apply: { agent: "claude-cli" } });
    const codex = stepAgentsForTemplate(thorough, { apply: { agent: "codex-cli" } });
    expect(effortOf(claude.apply)).not.toBe(effortOf(codex.apply));
  });
});

describe("templateConfigToWrite", () => {
  // applying-a-template-keeps-the-rest, now in one place both hosts use:
  // the writer replaces the file, so anything the configuration does not
  // mention has to be carried across deliberately.

  const economy = HARNESS_TEMPLATES[HARNESS_TEMPLATES.length - 1] as (typeof HARNESS_TEMPLATES)[number];

  it("keeps what the change already had", () => {
    const written = templateConfigToWrite(economy, {}, {
      gitStageAllowlist: { remotes: ["origin"], branches: ["main"] },
      maxStageAttempts: 9,
    });

    // Someone reaching for a cheaper run has not asked for the
    // constraint on what the agent may stage to be removed.
    expect(written.gitStageAllowlist).toEqual({ remotes: ["origin"], branches: ["main"] });
    // What the configuration does set, it sets.
    expect(written.maxStageAttempts).toBe(economy.config.maxStageAttempts);
  });

  it("writes the agent beside the effort", () => {
    const written = templateConfigToWrite(economy, { apply: { agent: "claude-cli" } });

    // An effort without its agent means nothing: `max` is a value
    // `claude` accepts and `codex` does not.
    expect(written.stepAgents?.apply).toEqual({ agent: "claude-cli", effort: "low" });
  });

  it("keeps the rest of a stage entry when the agent is unchanged", () => {
    const written = templateConfigToWrite(economy, { apply: { agent: "claude-cli" } }, {
      stepAgents: { apply: { agent: "claude-cli", model: "some-model", effort: "max" } },
    });

    // Only the effort was being chosen. The model is the workspace's.
    expect(written.stepAgents?.apply).toEqual({ agent: "claude-cli", model: "some-model", effort: "low" });
  });

  it("writes no stage entry for an agent that accepts no effort", () => {
    const written = templateConfigToWrite(economy, { apply: { agent: "vscode-chat" } });

    expect(written.stepAgents).toBeUndefined();
  });
});

describe("changeTemplateConfigToWrite — one file, whichever surface applied it", () => {
  // a-stage-override-keeps-its-custom-agent. The run dialog resolved a
  // configuration's effort against the change's *resolved* config, so an
  // inherited stage got the effort of the agent it would actually run.
  // The settings view resolved it against the change's own override,
  // where every stage the change does not name reads as "inherit", so
  // nothing got an effort at all. Same change, same configuration, two
  // files. Both surfaces now call this.

  const economy = HARNESS_TEMPLATES[HARNESS_TEMPLATES.length - 1] as (typeof HARNESS_TEMPLATES)[number];

  const global = (stepAgents: HarnessStepAgents): HarnessConfig => ({
    ...DEFAULT_HARNESS_CONFIG,
    stepAgents,
  });

  it("gives a stage the change does not name the effort of the agent it will run", () => {
    // The settings-view defect, at the level it was fixed: the override
    // names no stage, and the stage still runs `claude-cli`.
    const written = changeTemplateConfigToWrite(economy, global({ apply: "claude-cli" }), undefined);

    expect(written.stepAgents?.apply).toEqual({ agent: "claude-cli", effort: "low" });
  });

  it("produces one file from what each caller has in hand", () => {
    // The run dialog reaches this holding the global file and the
    // change's override; the settings view holds the same two, and used
    // to hold only the second. One input, one output, asserted rather
    // than described.
    const base = global({ propose: "claude-cli", apply: { agent: "codex-cli", model: "gpt-5" } });
    const override = { gitStageAllowlist: { remotes: ["origin"], branches: ["main"] } };

    const fromRunDialog = changeTemplateConfigToWrite(economy, base, override);
    const fromSettingsView = changeTemplateConfigToWrite(economy, base, { ...override });

    expect(fromRunDialog).toEqual(fromSettingsView);
    expect(fromRunDialog).toEqual({
      ...economy.config,
      gitStageAllowlist: { remotes: ["origin"], branches: ["main"] },
      stepAgents: {
        propose: { agent: "claude-cli", effort: "low" },
        // The global file's model is not restated in the change's
        // override — the change inherits it, and writing it here would
        // pin a choice the workspace is free to change.
        apply: { agent: "codex-cli", effort: "minimal" },
      },
    });
  });

  it("resolves against the agent the change names, not the one it replaced", () => {
    const written = changeTemplateConfigToWrite(
      economy,
      global({ apply: "claude-cli" }),
      { stepAgents: { apply: "codex-cli" } },
    );

    // `low` is `claude-cli`'s bottom and `minimal` is `codex-cli`'s.
    expect(written.stepAgents?.apply).toEqual({ agent: "codex-cli", effort: "minimal" });
  });

  it("keeps a custom agent the change set for the stage it is applied to", () => {
    // The two halves of this change meeting: the merge has to carry
    // `customAgent` for the entry the configuration then lays an effort
    // over, or applying a configuration silently drops it.
    const written = changeTemplateConfigToWrite(
      economy,
      global({ apply: "claude-cli" }),
      { stepAgents: { apply: { agent: "claude-cli", customAgent: "reviewer" } } },
    );

    expect(written.stepAgents?.apply).toEqual({
      agent: "claude-cli",
      customAgent: "reviewer",
      effort: "low",
    });
  });

  it("keeps every key the change had that the configuration does not mention", () => {
    const written = changeTemplateConfigToWrite(economy, global({}), {
      gitStageAllowlist: { remotes: ["origin"], branches: ["main"] },
    });

    expect(written.gitStageAllowlist).toEqual({ remotes: ["origin"], branches: ["main"] });
  });
});
