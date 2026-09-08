import { describe, expect, it } from "vitest";
import { findHarnessConfigLimits } from "./harness-config-findings.js";
import { DEFAULT_HARNESS_CONFIG, type HarnessConfig } from "./harness-config.js";
import { HARNESS_TEMPLATES, templatesForScope } from "./harness-templates.js";

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
    const overnight = HARNESS_TEMPLATES.find((t) => t.id === "overnight");
    expect(overnight?.scope).toBe("change");
    expect(templatesForScope("change").map((t) => t.id)).toContain("overnight");
    expect(templatesForScope("global").map((t) => t.id)).not.toContain("overnight");
  });

  it("has distinct ids", () => {
    expect(new Set(HARNESS_TEMPLATES.map((t) => t.id)).size).toBe(HARNESS_TEMPLATES.length);
  });
});

describe("HARNESS_TEMPLATES — the text and the configuration agree", () => {
  // a-template-keeps-its-promises. Overnight said "No checkpoints between
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
