import { describe, expect, it } from "vitest";
import type { GitHubChecksReport } from "./github-checks.js";
import { scenarioCheckState, scenarioEvidence } from "./scenario-evidence.js";

const delta = [{
  capability: "checkout",
  text: "## ADDED Requirements\n### Requirement: Shipping\n#### Scenario: Address changes\n"
    + "## MODIFIED Requirements\n### Requirement: Payment\n#### Scenario: Retry\n"
    + "## REMOVED Requirements\n### Requirement: Legacy\n#### Scenario: Legacy form",
}];
const association = {
  capability: "checkout", requirement: "Shipping", scenario: "Address changes", checks: ["build", "build"],
};

describe("scenario evidence", () => {
  it("inventories added and modified scenarios and resolves explicit associations", () => {
    expect(scenarioEvidence(delta, JSON.stringify({ scenarios: [association] }))).toEqual({
      scenarios: [
        { capability: "checkout", requirement: "Shipping", scenario: "Address changes", checks: ["build"] },
        { capability: "checkout", requirement: "Payment", scenario: "Retry", checks: [] },
      ],
      warnings: [],
    });
  });

  it.each(["{}", "invalid json", JSON.stringify({ scenarios: [association, association] })])(
    "reports invalid associations without applying any of them (%s)", (mapping) => {
      const result = scenarioEvidence(delta, mapping);
      expect(result.warnings).toHaveLength(1);
      expect(result.scenarios.every((scenario) => scenario.checks.length === 0)).toBe(true);
    },
  );

  it("uses only the unique observation for the reviewed revision", () => {
    const report: GitHubChecksReport = {
      kind: "checks", head: "head", checks: [{ name: "build", state: "success" }],
      expected: [], resultsComplete: true, rulesComplete: false,
    };
    expect(scenarioCheckState("build", "head", report)).toBe("success");
    expect(scenarioCheckState("build", "other", report)).toBe("GitHub reported a different commit");
    expect(scenarioCheckState("test", "head", report)).toBe("No result on this commit");
    expect(scenarioCheckState("build", "head", { ...report, resultsComplete: false })).toBe("GitHub results incomplete");
    expect(scenarioCheckState("build", "head", { ...report, checks: [...report.checks, ...report.checks] }))
      .toBe("Several results use this name");
  });
});
