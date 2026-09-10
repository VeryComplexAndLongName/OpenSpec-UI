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

describe("WorkspaceRunStatsPanel — the conclusions", () => {
  // recommend-from-what-happened. Three rows of medians leave the reader
  // to draw the conclusion; the conclusions are the easy part and the
  // figures already support them.

  it("names what it recommends, with the figure behind it", () => {
    render(<WorkspaceRunStatsPanel stats={stats({
      byAgent: [
        { agent: "cheap-one", runs: 10, completed: 10, costSamples: 10, medianCostUsd: 1, medianSeconds: 600, enough: true },
        { agent: "dear-one", runs: 10, completed: 10, costSamples: 10, medianCostUsd: 5, medianSeconds: 120, enough: true },
      ],
    })} />);

    const cheapest = screen.getByTestId("run-stats-recommendation-cheapest").textContent ?? "";
    expect(cheapest).toContain("Cheapest here: cheap-one");
    expect(cheapest).toContain("$1.00 median");
    expect(screen.getByTestId("run-stats-recommendation-fastest").textContent).toContain("dear-one");
  });

  it("says why a comparison was not made, rather than showing figures alone", () => {
    // "Nothing can be compared yet" and "no comparison was attempted"
    // look identical if the box just omits the conclusion.
    render(<WorkspaceRunStatsPanel stats={stats({
      byAgent: [
        { agent: "claude-cli-acp", runs: 18, completed: 16, costSamples: 16, medianCostUsd: 1.88, medianSeconds: 462, enough: true },
        { agent: "copilot-cli-acp", runs: 12, completed: 7, costSamples: 0, medianSeconds: 354, enough: true },
      ],
    })} />);

    expect(screen.queryByTestId("run-stats-recommendation-cheapest")).toBeNull();
    expect(screen.getByTestId("run-stats-gap-cheapest").textContent).toContain("only claude-cli-acp reports a cost");
  });
});

describe("WorkspaceRunStatsPanel — what the verifying stages found", () => {
  // quality-of-what-a-verify-found. Two questions about one log: an
  // agent that is cheap and fails its checks is not the cheap one.

  it("says which of the two empty states this is", () => {
    // A log with nothing in it and a log whose runs never reached a
    // verifying stage are different facts, and only one is fixed by
    // running something.
    render(<WorkspaceRunStatsPanel
      stats={stats()}
      quality={{ entriesRead: 108, entriesWithChecks: 0, byAgent: [] }}
    />);

    const basis = screen.getByTestId("verify-quality-basis").textContent ?? "";
    expect(basis).toContain("108 runs recorded");
    expect(basis).toContain("none of which reached a verifying stage");
  });

  it("reports a thin group as thin rather than as a rate", () => {
    render(<WorkspaceRunStatsPanel
      stats={stats()}
      quality={{
        entriesRead: 20,
        entriesWithChecks: 2,
        byAgent: [{ agent: "claude-cli", verifies: 2, withFailures: 1, checksRan: 6, checksFailed: 1, enough: false }],
      }}
    />);

    const row = screen.getByTestId("verify-quality-by-agent").textContent ?? "";
    expect(row).toContain("1 of 2 verifying stages");
    expect(row).toContain("1 of 6 checks failed");
    expect(row).toContain("too few to read as a rate");
  });

  it("renders nothing about quality in a host that did not read it", () => {
    // An empty block would claim every verify passed.
    render(<WorkspaceRunStatsPanel stats={stats()} />);

    expect(screen.queryByTestId("verify-quality")).toBeNull();
  });
});
