import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RunPlan } from "@openspec-ui/core/browser";
import { RunDialog } from "./RunDialog.js";

// one-way-in-to-run. Which path a change resolves to is `buildRunPlan`'s
// decision and is tested in core; these assert that the decision is
// shown, and that choosing acts on what was chosen.

function plan(overrides: Partial<RunPlan> = {}): RunPlan {
  return {
    resolved: "single-stage",
    because: 'autonomyLevel is "assisted", so one stage runs and you start each one',
    stageAgents: [
      { stage: "propose", agent: "claude-cli" },
      { stage: "apply", agent: undefined },
    ],
    offered: [
      { id: "chain", title: "Run the chain", describes: "Runs every stage in sequence." },
      { id: "single-stage", title: "Run one stage", describes: "Runs a single stage you pick." },
    ],
    findings: [],
    ...overrides,
  };
}

describe("RunDialog", () => {
  it("says what the configuration resolved to, and why", () => {
    // The sentence is the product. Without it a correct decision and a
    // broken one look the same — both just change what is on screen.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByTestId("run-dialog-because").textContent).toContain('autonomyLevel is "assisted"');
    expect(screen.getByRole("button", { name: "Run one stage (configured)" })).toBeTruthy();
  });

  it("says which stages have no agent rather than omitting them", () => {
    // A stage left out reads as a stage that does not run.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByTestId("run-dialog-stage-agents").textContent).toContain("apply: no agent set");
  });

  it("shows a ceiling that cannot act before anything is started", () => {
    render(
      <RunDialog
        changeName="demo"
        plan={plan({ findings: [{ kind: "reporting-unknown", stage: "apply", agent: "claude-cli", message: "reports no spend" }] })}
        onChoose={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByTestId("run-dialog-findings").textContent).toContain("reports no spend");
  });

  it("shows a recommendation with its grounds, never the answer alone", () => {
    render(
      <RunDialog
        changeName="demo"
        plan={plan({ advice: { template: { id: "careful", title: "Careful", intent: "", notFor: "", basis: "", scope: "either", config: {} }, grounds: ["20 tasks still open"] } })}
        onChoose={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const advice = screen.getByTestId("run-dialog-advice").textContent ?? "";
    expect(advice).toContain("Careful");
    expect(advice).toContain("20 tasks still open");
  });

  it("shows no recommendation panel when there is nothing to reason from", () => {
    // "No recommendation" and "a recommendation with no grounds" are
    // different, and only the first is honest.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.queryByTestId("run-dialog-advice")).toBeNull();
  });

  it("offers only the paths it was given", () => {
    // The standalone shell has no VS Code Chat, and offering a path that
    // cannot run is the same defect as a ceiling that cannot act.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.queryByTestId("run-dialog-path-vscode-agent")).toBeNull();
    expect(screen.getByTestId("run-dialog-path-chain")).toBeTruthy();
  });

  it("reports the path that was chosen, not the configured one", () => {
    const onChoose = vi.fn();
    render(<RunDialog changeName="demo" plan={plan()} onChoose={onChoose} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByTestId("run-dialog-path-chain"));

    expect(onChoose).toHaveBeenCalledWith("chain");
  });

  it("dismisses without choosing anything", () => {
    const onChoose = vi.fn();
    const onDismiss = vi.fn();
    render(<RunDialog changeName="demo" plan={plan()} onChoose={onChoose} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId("run-dialog-cancel"));

    expect(onDismiss).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
