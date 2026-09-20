import { describe, expect, it } from "vitest";
import { findHarnessConfigLimits } from "./harness-config-findings.js";
import type { HarnessConfig } from "./harness-config.js";

// settings-say-what-they-cannot-do:
// pure over an in-memory config — no files, no processes. Measured
// 2026-09-08 at under 10ms for the whole file.

function config(partial: Partial<HarnessConfig>): HarnessConfig {
  return {
    stepAgents: {},
    autonomyLevel: "semi-autonomous",
    reviewGate: { mode: "human-required" },
    ...partial,
  };
}

describe("findHarnessConfigLimits", () => {
  it("says a cost ceiling cannot act on an agent that reports only tokens", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "copilot-cli-acp" },
      budget: { maxCostUsd: 10 },
    }));

    const finding = findings.find((f) => f.stage === "apply");
    expect(finding?.kind).toBe("ceiling-cannot-act");
    expect(finding?.message).toContain("reports tokens and no cost");
  });

  it("says a token ceiling rarely acts on a cache-heavy agent, with the measurement", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "claude-cli-acp" },
      budget: { maxTokens: 2_000_000 },
    }));

    const finding = findings.find((f) => f.stage === "apply");
    expect(finding?.kind).toBe("ceiling-rarely-acts");
    // The number is the argument: without it this reads as a preference.
    expect(finding?.message).toContain("1,693,507");
  });

  it("reports a stage with a silent agent and no timeout as unbounded", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "codex-cli" },
      budget: { maxCostUsd: 10 },
    }));

    expect(findings.some((f) => f.kind === "stage-unbounded" && f.stage === "apply")).toBe(true);
  });

  it("drops the unbounded finding once a time ceiling exists", () => {
    // The whole point of the time ceiling: it needs no report, so it is
    // the one bound that applies to an agent that says nothing.
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "codex-cli" },
      budget: { maxCostUsd: 10 },
      timeout: { maxStageSeconds: 600 },
    }));

    expect(findings.some((f) => f.kind === "stage-unbounded")).toBe(false);
    // The spending ceiling still cannot act on it, and that is still said.
    expect(findings.some((f) => f.kind === "ceiling-cannot-act")).toBe(true);
  });

  it("says an unobserved agent is unknown rather than asserting either way", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "gemini-cli-acp" },
      budget: { maxCostUsd: 10 },
    }));

    const finding = findings.find((f) => f.stage === "apply");
    expect(finding?.kind).toBe("reporting-unknown");
    expect(findings.some((f) => f.kind === "ceiling-cannot-act")).toBe(false);
    expect(findings.some((f) => f.kind === "stage-unbounded")).toBe(false);
  });

  it("stays quiet when every configured ceiling can act", () => {
    // The case that matters most for whether anyone reads the others: a
    // surface that warns about a correct configuration becomes noise.
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "claude-cli-acp", verify: "claude-cli-acp" },
      budget: { maxCostUsd: 15 },
      timeout: { maxStageSeconds: 600 },
    }));

    expect(findings).toEqual([]);
  });

  it("says nothing about a stage with no agent configured", () => {
    // An unset stage runs on the host's default agent, chosen at
    // activation from what is installed. Naming one here could name the
    // wrong agent.
    const findings = findHarnessConfigLimits(config({ budget: { maxCostUsd: 10 } }));

    expect(findings).toEqual([]);
  });
});

// a-run-budget-has-a-unit: a ceiling in a unit a stage is not billed in.
describe("findHarnessConfigLimits - a ceiling in another unit", () => {
  it("says a credits ceiling cannot act on a stage billed in dollars", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "claude-cli-acp" },
      budget: { maxCost: { credits: 500 } },
    }));

    const finding = findings.find((one) => one.stage === "apply" && one.message.includes("credits"));
    expect(finding?.kind).toBe("ceiling-cannot-act");
    expect(finding?.message).toContain("is billed in dollars");
  });

  it("says nothing where the ceiling is in the unit the stage is billed in", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "copilot-cli-acp" },
      budget: { maxCost: { credits: 500 } },
    }));

    expect(findings.filter((one) => one.message.includes("maxCost"))).toEqual([]);
  });

  it("folds the spelling of the unit rather than reporting a false mismatch", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "copilot-cli-acp" },
      budget: { maxCost: { Credits: 500 } },
    }));

    expect(findings.filter((one) => one.message.includes("maxCost"))).toEqual([]);
  });

  it("counts a ceiling in any unit when saying an agent that reports nothing defeats it", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "claude-cli" },
      budget: { maxCost: { credits: 500 } },
      timeout: { maxRunSeconds: 600 },
    }));

    const finding = findings.find((one) => one.stage === "apply");
    expect(finding?.kind).toBe("ceiling-cannot-act");
    expect(finding?.message).toContain("reports no usage at all");
  });
});
