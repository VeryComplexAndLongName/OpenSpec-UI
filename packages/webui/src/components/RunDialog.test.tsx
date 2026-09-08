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
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onApplyTemplate={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByTestId("run-dialog-because").textContent).toContain('autonomyLevel is "assisted"');
    expect(screen.getByRole("button", { name: "Run one stage (configured)" })).toBeTruthy();
  });

  it("says which stages have no agent rather than omitting them", () => {
    // A stage left out reads as a stage that does not run.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onApplyTemplate={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByTestId("run-dialog-stage-agents").textContent).toContain("apply: no agent set");
  });

  it("shows a ceiling that cannot act before anything is started", () => {
    render(
      <RunDialog
        changeName="demo"
        plan={plan({ findings: [{ kind: "reporting-unknown", stage: "apply", agent: "claude-cli", message: "reports no spend" }] })}
        onChoose={vi.fn()}
        onApplyTemplate={vi.fn()} onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByTestId("run-dialog-findings").textContent).toContain("reports no spend");
  });

  it("shows a recommendation with its grounds, never the answer alone", () => {
    render(
      <RunDialog
        changeName="demo"
        plan={plan({ advice: { template: { id: "balanced", title: "Balanced", intent: "", notFor: "", basis: "", scope: "either", config: {} }, grounds: ["20 tasks still open"] } })}
        onChoose={vi.fn()}
        onApplyTemplate={vi.fn()} onDismiss={vi.fn()}
      />,
    );

    const advice = screen.getByTestId("run-dialog-advice").textContent ?? "";
    expect(advice).toContain("Balanced");
    expect(advice).toContain("20 tasks still open");
  });

  it("shows no recommendation panel when there is nothing to reason from", () => {
    // "No recommendation" and "a recommendation with no grounds" are
    // different, and only the first is honest.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onApplyTemplate={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.queryByTestId("run-dialog-advice")).toBeNull();
  });

  it("offers only the paths it was given", () => {
    // The standalone shell has no VS Code Chat, and offering a path that
    // cannot run is the same defect as a ceiling that cannot act.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onApplyTemplate={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.queryByTestId("run-dialog-path-vscode-agent")).toBeNull();
    expect(screen.getByTestId("run-dialog-path-chain")).toBeTruthy();
  });

  it("reports the path that was chosen, not the configured one", () => {
    const onChoose = vi.fn();
    render(<RunDialog changeName="demo" plan={plan()} onChoose={onChoose} onApplyTemplate={vi.fn()} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByTestId("run-dialog-path-chain"));

    expect(onChoose).toHaveBeenCalledWith("chain");
  });

  it("dismisses without choosing anything", () => {
    const onChoose = vi.fn();
    const onDismiss = vi.fn();
    render(<RunDialog changeName="demo" plan={plan()} onChoose={onChoose} onApplyTemplate={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId("run-dialog-cancel"));

    expect(onDismiss).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });
});

describe("RunDialog — advising, not just picking a path", () => {
  // run-dialog-actually-advises. The first version of this dialog was
  // reported, fairly, as "just a path picker": it never advised, offered
  // no way to act on advice, and said nothing when the configuration was
  // fine.

  const recommended = { id: "balanced", title: "Balanced" };

  it("says every ceiling can act, rather than rendering nothing", () => {
    // Silence makes "examined and fine" identical to "not examined" —
    // the distinction this project has drawn four times and missed in
    // the surface built to make it.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onApplyTemplate={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByTestId("run-dialog-no-findings").textContent).toContain("can act");
    expect(screen.queryByTestId("run-dialog-findings")).toBeNull();
  });

  it("offers the named configurations with what each is for and when it is wrong", () => {
    // A list carrying only names gives no help choosing between them.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onApplyTemplate={vi.fn()} onDismiss={vi.fn()} />);

    const templates = screen.getByTestId("run-dialog-templates").textContent ?? "";
    expect(templates).toContain("Not for:");
    expect(screen.getByTestId("run-dialog-template-fastest")).toBeTruthy();
  });

  it("marks the recommended configuration among the ones it offers", () => {
    // A recommendation that cannot be acted on is a remark.
    render(
      <RunDialog
        changeName="demo"
        plan={plan({ advice: { template: recommended as never, grounds: ["20 tasks still open"] } })}
        onChoose={vi.fn()}
        onApplyTemplate={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByTestId("run-dialog-template-balanced").textContent).toContain("(recommended)");
  });

  it("reports the configuration that was applied", () => {
    const onApplyTemplate = vi.fn();
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onApplyTemplate={onApplyTemplate} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByTestId("run-dialog-template-fastest").querySelector("button")!);

    expect(onApplyTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: "fastest" }));
  });

  it("offers only the configurations a change may be given", () => {
    // `templatesForScope("change")`, the same function the settings view
    // uses, so a template refused on save is never proposed here.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onApplyTemplate={vi.fn()} onDismiss={vi.fn()} />);

    const ids = [...screen.getByTestId("run-dialog-templates").querySelectorAll("li")]
      .map((item) => item.getAttribute("data-testid"));
    // Cheapest first, then in order of what each will spend — the axis
    // they are named on (templates-by-cost-and-speed).
    expect(ids).toEqual([
      "run-dialog-template-min-cost",
      "run-dialog-template-balanced",
      "run-dialog-template-fastest",
    ]);
  });
});
