import { describe, expect, it } from "vitest";
import { recommendFromRunStats } from "./run-recommendations.js";
import type { AgentRunGroup, WorkspaceRunStats } from "./workspace-run-stats.js";

// recommend-from-what-happened:
// pure over an aggregate — no files, no processes.

function group(overrides: Partial<AgentRunGroup> & { agent: string }): AgentRunGroup {
  return { runs: 10, completed: 10, costSamples: 10, enough: true, ...overrides };
}

function stats(byAgent: AgentRunGroup[]): WorkspaceRunStats {
  return {
    entriesRead: 0,
    entriesFromDeletedChanges: 0,
    runs: byAgent.reduce((total, entry) => total + entry.runs, 0),
    runsWithEffort: 0,
    byAgent,
    byAgentAndEffort: [],
    enoughRuns: 5,
  };
}

const kindsOf = (result: ReturnType<typeof recommendFromRunStats>) => result.offered.map((entry) => entry.kind);

describe("recommendFromRunStats", () => {
  it("names the cheapest with the figure it won on", () => {
    const result = recommendFromRunStats(stats([
      group({ agent: "claude-cli-acp", medianCostUsd: 1.88, medianSeconds: 462 }),
      group({ agent: "codex-cli", medianCostUsd: 4.2, medianSeconds: 300 }),
    ]));

    const cheapest = result.offered.find((entry) => entry.kind === "cheapest");
    expect(cheapest?.agents).toEqual(["claude-cli-acp"]);
    // The name is the conclusion; the observation is what makes it
    // arguable rather than only acceptable.
    expect(cheapest?.because).toContain("$1.88 median");
    expect(cheapest?.because).toContain("run(s)");
  });

  it("offers no cost recommendation when only one agent reports a cost", () => {
    // A superlative over one candidate is not a comparison. On this
    // repository, measured 2026-09-09, exactly this silences it: one
    // agent of three reports a cost at all.
    const result = recommendFromRunStats(stats([
      group({ agent: "claude-cli-acp", medianCostUsd: 1.88, medianSeconds: 462 }),
      group({ agent: "copilot-cli-acp", costSamples: 0, medianSeconds: 354 }),
    ]));

    expect(kindsOf(result)).not.toContain("cheapest");
    const gap = result.gaps.find((entry) => entry.kind === "cheapest");
    expect(gap?.reason).toContain("only claude-cli-acp reports a cost");
  });

  it("says why when no agent has reported a cost at all", () => {
    const result = recommendFromRunStats(stats([
      group({ agent: "claude-cli", costSamples: 0, medianSeconds: 1134 }),
      group({ agent: "copilot-cli-acp", costSamples: 0, medianSeconds: 354 }),
    ]));

    expect(result.gaps.find((entry) => entry.kind === "cheapest")?.reason).toContain("no agent has reported a cost");
  });

  it("says the costs are too few, not that none were reported", () => {
    // quality-is-charged-to-the-agent-whose-work-was-checked. The reason
    // was drawn from the eligible groups only, so four runs that each
    // reported a cost read as "no agent has reported a cost across 4
    // recorded run(s)" — a reason that is false about the very log it
    // was drawn from.
    const result = recommendFromRunStats(stats([
      group({ agent: "claude-cli-acp", runs: 2, completed: 2, medianCostUsd: 1.88, medianSeconds: 462, enough: false }),
      group({ agent: "codex-cli", runs: 2, completed: 2, medianCostUsd: 4.2, medianSeconds: 300, enough: false }),
    ]));

    const gap = result.gaps.find((entry) => entry.kind === "cheapest");
    expect(gap?.reason).toContain("2 agents reported a cost");
    expect(gap?.reason).toContain("fewer than 5 runs");
    expect(gap?.reason).not.toContain("no agent has reported a cost");
    // The same three-way distinction on the other two measures.
    expect(result.gaps.find((entry) => entry.kind === "fastest")?.reason).toContain("2 agents recorded a duration");
    expect(result.gaps.find((entry) => entry.kind === "most-likely-to-finish")?.reason)
      .toContain("2 agents recorded runs");
  });

  it("says nothing has run when the log holds no runs at all", () => {
    const result = recommendFromRunStats(stats([]));

    expect(result.offered).toEqual([]);
    expect(result.gaps.find((entry) => entry.kind === "cheapest")?.reason)
      .toContain("no agent has reported a cost across 0 recorded runs");
    expect(result.gaps.find((entry) => entry.kind === "most-likely-to-finish")?.reason)
      .toContain("no run has been recorded");
  });

  it("does not treat an agent that reported nothing as costing zero", () => {
    const result = recommendFromRunStats(stats([
      group({ agent: "claude-cli-acp", medianCostUsd: 1.88, medianSeconds: 462 }),
      group({ agent: "codex-cli", medianCostUsd: 4.2, medianSeconds: 300 }),
      group({ agent: "silent-agent", costSamples: 0, medianSeconds: 100 }),
    ]));

    expect(result.offered.find((entry) => entry.kind === "cheapest")?.agents).toEqual(["claude-cli-acp"]);
  });

  it("names every agent that ties on the measure", () => {
    // Breaking a tie arbitrarily presents a fabricated distinction as a
    // finding.
    const result = recommendFromRunStats(stats([
      group({ agent: "a", medianCostUsd: 2, medianSeconds: 300 }),
      group({ agent: "b", medianCostUsd: 2, medianSeconds: 600 }),
    ]));

    expect(result.offered.find((entry) => entry.kind === "cheapest")?.agents).toEqual(["a", "b"]);
  });

  it("does not let a group below the threshold win", () => {
    // The threshold exists because a figure over too few runs is not an
    // answer, and a superlative is the one place a figure is stated as
    // an answer rather than as a reading.
    const result = recommendFromRunStats(stats([
      group({ agent: "well-recorded", medianCostUsd: 3, medianSeconds: 600 }),
      group({ agent: "barely-recorded", runs: 2, completed: 2, medianCostUsd: 0.1, medianSeconds: 10, enough: false }),
      group({ agent: "other", medianCostUsd: 5, medianSeconds: 900 }),
    ]));

    expect(result.offered.find((entry) => entry.kind === "cheapest")?.agents).toEqual(["well-recorded"]);
    expect(result.offered.find((entry) => entry.kind === "fastest")?.agents).toEqual(["well-recorded"]);
  });

  it("recommends the fastest and the most likely to finish", () => {
    const result = recommendFromRunStats(stats([
      group({ agent: "quick-but-flaky", runs: 10, completed: 5, medianSeconds: 120, costSamples: 0 }),
      group({ agent: "slow-but-sure", runs: 10, completed: 10, medianSeconds: 900, costSamples: 0 }),
    ]));

    expect(result.offered.find((entry) => entry.kind === "fastest")?.agents).toEqual(["quick-but-flaky"]);
    const reliable = result.offered.find((entry) => entry.kind === "most-likely-to-finish");
    expect(reliable?.agents).toEqual(["slow-but-sure"]);
    expect(reliable?.because).toContain("10 of 10");
  });

  it("offers nothing and says why when there is only one agent", () => {
    const result = recommendFromRunStats(stats([
      group({ agent: "alone", medianCostUsd: 1, medianSeconds: 100 }),
    ]));

    expect(result.offered).toEqual([]);
    expect(result.gaps.map((entry) => entry.kind).sort()).toEqual(["cheapest", "fastest", "most-likely-to-finish"]);
  });
});
