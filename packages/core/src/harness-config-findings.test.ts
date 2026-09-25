import { describe, expect, it } from "vitest";
import { findHarnessConfigLimits, groupHarnessFindings } from "./harness-config-findings.js";
import type { HarnessConfig } from "./harness-config.js";

// a-warning-is-said-once: the user's own configuration, claude-cli on every
// stage and a dollar budget, gave four lines differing in one word.
describe("groupHarnessFindings", () => {
  const everyStage = {
    propose: "claude-cli",
    review: "claude-cli",
    apply: "claude-cli",
    verify: "claude-cli",
  } as const;

  it("says one thing once, naming every stage it holds on", () => {
    const findings = findHarnessConfigLimits({
      stepAgents: everyStage,
      autonomyLevel: "assisted",
      reviewGate: { mode: "human-required" },
      budget: { maxCostUsd: 5 },
      timeout: { maxStageSeconds: 600 },
    });

    expect(findings).toHaveLength(4);
    expect(groupHarnessFindings(findings)).toEqual([{
      kind: "ceiling-cannot-act",
      agent: "claude-cli",
      stages: ["propose", "review", "apply", "verify"],
      message: '"claude-cli" reports no usage at all, so no spending ceiling can act on "propose", "review", "apply" and "verify" however large the spend.',
    }]);
  });

  it("keeps apart what differs in kind or in agent, in the order the stages run", () => {
    const findings = findHarnessConfigLimits({
      stepAgents: { propose: "claude-cli", review: "copilot-cli-acp", apply: "claude-cli" },
      autonomyLevel: "assisted",
      reviewGate: { mode: "human-required" },
      budget: { maxCostUsd: 5 },
    });

    const groups = groupHarnessFindings(findings);

    expect(groups.map((group) => [group.kind, group.agent, group.stages])).toEqual([
      ["ceiling-cannot-act", "claude-cli", ["propose", "apply"]],
      ["stage-unbounded", "claude-cli", ["propose", "apply"]],
      ["ceiling-cannot-act", "copilot-cli-acp", ["review"]],
    ]);
    expect(groups[1]?.message).toBe(
      '"propose" and "apply" can run without any bound: "claude-cli" reports nothing for a spending ceiling to compare, and no timeout is configured. A time ceiling is the only one that applies here.',
    );
  });

  it("leaves a single finding's words as they were", () => {
    const findings = findHarnessConfigLimits({
      stepAgents: { apply: "copilot-cli-acp" },
      autonomyLevel: "assisted",
      reviewGate: { mode: "human-required" },
      budget: { maxCostUsd: 5 },
    });

    expect(groupHarnessFindings(findings).map((group) => group.message)).toEqual(findings.map((finding) => finding.message));
  });
});

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

  // a-run-can-outgrow-its-context. A gauge is a different question from a
  // spend, so it is answered separately.
  it("says a context ceiling cannot act on an agent that speaks no ACP", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "claude-cli" },
      budget: { maxContextShare: 0.8 },
      timeout: { maxRunSeconds: 60 },
    }));

    const finding = findings.find((one) => one.stage === "apply");
    expect(finding?.kind).toBe("ceiling-cannot-act");
    expect(finding?.message).toContain("never says how full its context is");
  });

  it("says nothing about a context ceiling on an agent that sends the gauge", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "deepseek-cli-acp" },
      budget: { maxContextShare: 0.8 },
    }));

    expect(findings.filter((one) => one.stage === "apply")).toEqual([]);
  });

  // An ACP agent nobody has watched might send one: warning would be a
  // guess dressed as a finding.
  it("says nothing about a context ceiling on an agent nobody has watched", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "codex-cli-acp" },
      budget: { maxContextShare: 0.8 },
      timeout: { maxRunSeconds: 60 },
    }));

    expect(findings.filter((one) => one.kind === "ceiling-cannot-act")).toEqual([]);
  });

  // The stage is bounded after all: the ceiling reads a figure this agent
  // does send, and it stops a stage already running.
  it("does not call a stage unbounded where a context ceiling binds it", () => {
    const findings = findHarnessConfigLimits(config({
      stepAgents: { apply: "deepseek-cli-acp" },
      budget: { maxContextShare: 0.8 },
    }));

    expect(findings.filter((one) => one.kind === "stage-unbounded")).toEqual([]);
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
