import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WorkspaceRunStats } from "@openspec-ui/core/browser";
import { WorkspaceRunStatsPanel } from "./WorkspaceRunStatsPanel.js";

// dialog-shows-what-runs-cost. Every figure carries what it rests on: a
// median over fifteen samples and a median over two are different claims.

function stats(overrides: Partial<WorkspaceRunStats> = {}): WorkspaceRunStats {
  return {
    entriesRead: 108,
    entriesFromDeletedChanges: 28,
    runs: 40,
    runsWithEffort: 1,
    byAgent: [],
    byAgentAndEffort: [],
    enoughRuns: 5,
    ...overrides,
  };
}

const claude = {
  agent: "claude-cli-acp",
  runs: 18,
  completed: 16,
  costSamples: 16,
  medianCostUsd: 1.88,
  p90CostUsd: 7.14,
  medianSeconds: 462,
  p90Seconds: 1200,
  enough: true,
};

describe("WorkspaceRunStatsPanel", () => {
  it("shows an agent's figures with the runs behind them", () => {
    render(<WorkspaceRunStatsPanel stats={stats({ byAgent: [claude] })} />);

    const text = screen.getByTestId("run-stats-by-agent").textContent ?? "";
    expect(text).toContain("18 runs, 16 completed");
    expect(text).toContain("$1.88 median");
    expect(text).toContain("from 16 runs");
  });

  it("says an agent reports no cost rather than showing zero", () => {
    // Six of the ten agents report nothing at all. A cost of zero would
    // say something false about them.
    render(<WorkspaceRunStatsPanel stats={stats({
      byAgent: [{ agent: "copilot-cli-acp", runs: 12, completed: 7, costSamples: 0, medianSeconds: 354, enough: true }],
    })} />);

    const text = screen.getByTestId("run-stats-by-agent").textContent ?? "";
    expect(text).toContain("no cost reported by this agent");
    expect(text).not.toContain("$0.00");
  });

  it("marks a group that rests on too few runs", () => {
    // Marked rather than omitted: omitting makes "too little is known"
    // indistinguishable from "never run".
    render(<WorkspaceRunStatsPanel stats={stats({
      byAgent: [{ agent: "codex-cli", runs: 2, completed: 2, costSamples: 0, enough: false }],
    })} />);

    expect(screen.getByTestId("run-stats-below-threshold").textContent).toContain("2 of 5 needed");
  });

  it("says nothing is recorded yet, and how much was read", () => {
    // A box that looks the same before and after a run has happened gives
    // a reader no way to tell it is working.
    render(<WorkspaceRunStatsPanel stats={stats({ runs: 0, entriesRead: 4, entriesFromDeletedChanges: 4 })} />);

    const text = screen.getByTestId("run-stats-empty").textContent ?? "";
    expect(text).toContain("Nothing recorded yet");
    expect(text).toContain("4 audit entries read");
    expect(text).toContain("no longer exist");
  });

  it("explains an empty effort grouping rather than leaving it blank", () => {
    // The effort field is recent, so this grouping is empty for reasons
    // that have nothing to do with whether it works.
    render(<WorkspaceRunStatsPanel stats={stats({ byAgent: [claude], byAgentAndEffort: [] })} />);

    const note = screen.getByTestId("run-stats-by-effort-note").textContent ?? "";
    expect(note).toContain("No run has recorded which effort");
    expect(note).toContain("1 with an effort");
  });

  it("shows the effort grouping when there is one", () => {
    render(<WorkspaceRunStatsPanel stats={stats({
      byAgent: [claude],
      byAgentAndEffort: [{ ...claude, effort: "high", runs: 6, completed: 6 }],
      runsWithEffort: 6,
    })} />);

    expect(screen.getByTestId("run-stats-by-effort").textContent).toContain("claude-cli-acp · high");
  });

  it("says how many entries were set aside and why", () => {
    // A reader who knows some entries were excluded can judge whether the
    // rule that excluded them was right. A total alone does not allow it.
    render(<WorkspaceRunStatsPanel stats={stats({ byAgent: [claude] })} />);

    const basis = screen.getByTestId("run-stats-basis").textContent ?? "";
    expect(basis).toContain("108 audit entries");
    expect(basis).toContain("28 set aside");
  });
});
