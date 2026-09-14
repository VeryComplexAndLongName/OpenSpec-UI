import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DescribedChangeState, RunPlan } from "@openspec-ui/core/browser";
import { RunDialog } from "./RunDialog.js";

// a-change-says-where-it-stands 7.2. Which word a change has is core's
// `describeChangeState`; these assert that the dialog leads with it, and asks
// before starting a change that stands somewhere else.

const PLAN: RunPlan = {
  resolved: "chain",
  because: 'autonomyLevel is "autonomous", so the chain runs',
  stageAgents: [{ stage: "apply", agent: "claude-cli" }],
  offered: [{ id: "chain", title: "Run the chain", describes: "Runs every stage in sequence." }],
  findings: [],
};

function props(standing: DescribedChangeState, onChoose = vi.fn()) {
  return { changeName: "demo", plan: PLAN, standing, onChoose, onApplyTemplate: vi.fn(), onDismiss: vi.fn(), onSchedule: vi.fn() };
}

describe("RunDialog — where the change stands", () => {
  it("leads with Archived on main, and starts no path until the person confirms", () => {
    const onChoose = vi.fn();
    render(<RunDialog {...props({
      key: "archived-on-main",
      word: "Archived on main",
      colour: "settled",
      badge: "A",
      lines: [{ text: "Ready", source: "this checkout" }],
    }, onChoose)} />);

    expect(screen.getByTestId("run-dialog-standing")).toHaveTextContent("Archived on main");
    expect(screen.getByTestId("run-dialog-standing")).toHaveTextContent("Ready (this checkout)");
    expect(screen.getByTestId("run-dialog-path-chain")).toBeDisabled();
    expect(screen.getByTestId("run-dialog-schedule-chain")).toBeDisabled();

    fireEvent.click(screen.getByTestId("run-dialog-start-anyway"));
    fireEvent.click(screen.getByTestId("run-dialog-path-chain"));

    expect(onChoose).toHaveBeenCalledWith("chain");
  });

  it("starts a change only here as before, with no confirmation", () => {
    const onChoose = vi.fn();
    render(<RunDialog {...props({
      key: "ready",
      word: "Ready",
      colour: "none",
      lines: [{ text: "Only here", source: "every source read" }],
    }, onChoose)} />);

    expect(screen.getByTestId("run-dialog-standing")).toHaveTextContent("Only here");
    expect(screen.queryByTestId("run-dialog-start-anyway")).toBeNull();
    fireEvent.click(screen.getByTestId("run-dialog-path-chain"));

    expect(onChoose).toHaveBeenCalledWith("chain");
  });
});
