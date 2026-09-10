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
        plan={plan({ advice: { template: { id: "balanced", title: "Balanced", intent: "", notFor: "", basis: "", effortLevel: "medium", scope: "either", config: {} }, grounds: ["20 tasks still open"] } })}
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
    expect(screen.getByTestId("run-dialog-template-thorough")).toBeTruthy();
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

    fireEvent.click(screen.getByTestId("run-dialog-template-economy").querySelector("button")!);

    expect(onApplyTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: "economy" }));
  });

  it("offers only the configurations a change may be given", () => {
    // `templatesForScope("change")`, the same function the settings view
    // uses, so a template refused on save is never proposed here.
    render(<RunDialog changeName="demo" plan={plan()} onChoose={vi.fn()} onApplyTemplate={vi.fn()} onDismiss={vi.fn()} />);

    const ids = [...screen.getByTestId("run-dialog-templates").querySelectorAll("li")]
      .map((item) => item.getAttribute("data-testid"));
    // Most effort first, then in order down the range — the axis they
    // are named on (presets-by-effort).
    expect(ids).toEqual([
      "run-dialog-template-thorough",
      "run-dialog-template-careful",
      "run-dialog-template-balanced",
      "run-dialog-template-economy",
    ]);
  });

  it("says what each configuration would set for the agents this change uses", () => {
    // A level is not a value: `max` is one `claude` accepts and `codex`
    // does not. The dialog resolves it so the answer is visible before
    // the configuration is applied rather than after.
    render(
      <RunDialog
        changeName="demo"
        plan={plan({ stageAgents: [{ stage: "apply", agent: "codex-cli" }] })}
        onChoose={vi.fn()}
        onApplyTemplate={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByTestId("run-dialog-template-thorough-effort").textContent).toContain("codex-cli high");
  });

  it("says plainly when the agent takes no effort setting at all", () => {
    // Five of the ten registered agents accept none, and for those the
    // configurations differ in their ceilings alone. A dial that does
    // nothing silently is worse than one that says so.
    render(
      <RunDialog
        changeName="demo"
        plan={plan({ stageAgents: [{ stage: "apply", agent: "gemini-cli" }] })}
        onChoose={vi.fn()}
        onApplyTemplate={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByTestId("run-dialog-template-thorough-effort").textContent)
      .toContain("only the ceilings differ");
  });
});

/** The props every case here shares — this file's other tests spell them
 * out inline, and repeating five of them per new case would bury what
 * each one is about. */
function baseProps() {
  return {
    changeName: "demo",
    plan: plan(),
    onChoose: vi.fn(),
    onApplyTemplate: vi.fn(),
    onDismiss: vi.fn(),
  };
}

describe("RunDialog — asking for a run at a time", () => {
  // a-run-can-be-scheduled. "Now" and "at a time" are the same question,
  // asked once — which is why this lives in the dialog and not beside it.

  it("offers no schedule at all in a host that cannot keep one", () => {
    // An unusable control is the defect this dialog exists to remove.
    render(<RunDialog {...baseProps()} />);

    expect(screen.queryByTestId("run-dialog-schedule")).toBeNull();
  });

  it("refuses a time that has already passed, where it was entered", () => {
    const onSchedule = vi.fn();
    render(<RunDialog {...baseProps()} onSchedule={onSchedule} />);

    fireEvent.change(screen.getByLabelText("Start at"), { target: { value: "2020-01-01T09:00" } });
    fireEvent.click(screen.getByTestId("run-dialog-schedule-chain"));

    expect(onSchedule).not.toHaveBeenCalled();
    expect(screen.getByTestId("run-dialog-schedule-problem").textContent).toContain("already passed");
  });

  it("schedules the path that was asked for", () => {
    const onSchedule = vi.fn();
    render(<RunDialog {...baseProps()} onSchedule={onSchedule} />);
    const later = new Date(Date.now() + 60 * 60 * 1000);
    const local = new Date(later.getTime() - later.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

    fireEvent.change(screen.getByLabelText("Start at"), { target: { value: local } });
    fireEvent.click(screen.getByTestId("run-dialog-schedule-chain"));

    expect(onSchedule).toHaveBeenCalledWith("chain", expect.any(String));
  });

  it("says the application must be open, before anyone relies on it", () => {
    render(<RunDialog {...baseProps()} onSchedule={vi.fn()} />);

    expect(screen.getByText(/needs this application open/)).toBeTruthy();
  });

  it("says why it opened when a schedule opened it", () => {
    // A dialog opening by itself is a different event from a person
    // opening it, and which one it was has to be legible.
    render(<RunDialog {...baseProps()} note="Scheduled for 09:00 — starting 3 hours late." />);

    expect(screen.getByTestId("run-dialog-note").textContent).toContain("3 hours late");
  });

  it("refuses a time it cannot read rather than throwing on the way to one", () => {
    // a-schedule-keeps-its-promise, task 6.3. `toISOString()` used to
    // run first, so a value no date can be made of raised an uncaught
    // RangeError and the sentence written for it was unreachable.
    const onSchedule = vi.fn();
    render(<RunDialog {...baseProps()} onSchedule={onSchedule} />);

    // A `datetime-local` input blanks a value it cannot parse, and a
    // browser that does not implement the type renders a text box that
    // does not. Either way what reaches the handler is unreadable.
    fireEvent.change(screen.getByLabelText("Start at"), { target: { value: "not-a-time" } });
    fireEvent.click(screen.getByTestId("run-dialog-schedule-chain"));

    expect(onSchedule).not.toHaveBeenCalled();
    expect(screen.getByTestId("run-dialog-schedule-problem").textContent)
      .toContain("not a time this can read");
  });

  it("is a dialog with a name, and takes focus when it opened by itself", () => {
    // a-schedule-keeps-its-promise, task 6.1. A screen-reader user has
    // to be told a run dialog appeared without their action.
    render(<RunDialog {...baseProps()} note="Scheduled for 09:00 — starting 3 hours late." />);

    const dialog = screen.getByRole("dialog", { name: "Run demo" });
    expect(dialog).toBeTruthy();
    expect(document.activeElement).toBe(dialog);
  });

  it("does not steal focus from the person who opened it", () => {
    render(<RunDialog {...baseProps()} />);

    expect(screen.getByRole("dialog", { name: "Run demo" })).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
  });
});
