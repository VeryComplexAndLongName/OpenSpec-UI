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
