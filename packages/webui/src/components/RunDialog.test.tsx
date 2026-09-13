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

/** The props every case here shares. */
function baseProps() {
  return {
    changeName: "demo",
    plan: plan(),
    onChoose: vi.fn(),
    onApplyTemplate: vi.fn(),
    onDismiss: vi.fn(),
  };
}

describe("RunDialog", () => {
  it("says what the configuration resolved to, and why", () => {
    // The sentence is the product. Without it a correct decision and a
    // broken one look the same — both just change what is on screen.
    render(<RunDialog {...baseProps()} />);

    expect(screen.getByTestId("run-dialog-because").textContent).toContain('autonomyLevel is "assisted"');
    expect(screen.getByRole("button", { name: "Run one stage (configured)" })).toBeTruthy();
  });

  it("says which stages have no agent rather than omitting them", () => {
    render(<RunDialog {...baseProps()} />);

    expect(screen.getByTestId("run-dialog-stage-agents").textContent).toContain("apply: no agent set");
  });

  it("shows a ceiling that cannot act before anything is started", () => {
    render(
      <RunDialog
        {...baseProps()}
        plan={plan({ findings: [{ kind: "reporting-unknown", stage: "apply", agent: "claude-cli", message: "reports no spend" }] })}
      />,
    );

    expect(screen.getByTestId("run-dialog-findings").textContent).toContain("reports no spend");
  });

  it("shows a recommendation with its grounds, never the answer alone", () => {
    render(
      <RunDialog
        {...baseProps()}
        plan={plan({ advice: { template: { id: "balanced", title: "Balanced", intent: "", notFor: "", basis: "", effortLevel: "medium", scope: "either", config: {} }, grounds: ["20 tasks still open"] } })}
      />,
    );

    const advice = screen.getByTestId("run-dialog-advice").textContent ?? "";
    expect(advice).toContain("Balanced");
    expect(advice).toContain("20 tasks still open");
  });

  it("shows no recommendation panel when there is nothing to reason from", () => {
    render(<RunDialog {...baseProps()} />);

    expect(screen.queryByTestId("run-dialog-advice")).toBeNull();
  });

  it("offers only the paths it was given", () => {
    render(<RunDialog {...baseProps()} />);

    expect(screen.queryByTestId("run-dialog-path-vscode-agent")).toBeNull();
    expect(screen.getByTestId("run-dialog-path-chain")).toBeTruthy();
  });

  it("reports the path that was chosen, not the configured one", () => {
    const props = baseProps();
    render(<RunDialog {...props} />);

    fireEvent.click(screen.getByTestId("run-dialog-path-chain"));

    expect(props.onChoose).toHaveBeenCalledWith("chain");
  });

  it("dismisses without choosing anything", () => {
    const props = baseProps();
    render(<RunDialog {...props} />);

    fireEvent.click(screen.getByTestId("run-dialog-cancel"));

    expect(props.onDismiss).toHaveBeenCalled();
    expect(props.onChoose).not.toHaveBeenCalled();
  });
});

describe("RunDialog — advising, not just picking a path", () => {
  // run-dialog-actually-advises, then a-change-is-configured-from-the-change:
  // the configurations are one list, and what applying one wrote is said
  // beside the button rather than above the dialog.

  const recommended = { id: "balanced", title: "Balanced" };
  const select = () => screen.getByLabelText("Named configuration") as HTMLSelectElement;

  it("says every ceiling can act, rather than rendering nothing", () => {
    render(<RunDialog {...baseProps()} />);

    expect(screen.getByTestId("run-dialog-no-findings").textContent).toContain("can act");
    expect(screen.queryByTestId("run-dialog-findings")).toBeNull();
  });

  it("offers the named configurations in one list, with what the chosen one is for and when it is wrong", () => {
    render(<RunDialog {...baseProps()} />);

    expect(select()).toBeTruthy();
    expect(screen.getByTestId("run-dialog-named-configuration-description").textContent).toContain("Not for:");
    expect(screen.queryByTestId("run-dialog-templates")).toBeNull();
  });

  it("chooses and marks the recommended configuration", () => {
    render(<RunDialog {...baseProps()} plan={plan({ advice: { template: recommended as never, grounds: ["20 tasks still open"] } })} />);

    expect(select()).toHaveValue("balanced");
    expect(select().querySelector("option[value='balanced']")?.textContent).toContain("(recommended)");
  });

  it("applies the configuration that was chosen", () => {
    const props = baseProps();
    render(<RunDialog {...props} />);

    fireEvent.change(select(), { target: { value: "economy" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(props.onApplyTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: "economy" }));
  });

  it("says what applying wrote beside the Apply button", () => {
    const props = baseProps();
    const { rerender } = render(<RunDialog {...props} />);

    fireEvent.change(select(), { target: { value: "economy" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    rerender(<RunDialog {...props} appliedNote='Applied "Economy" to openspec/changes/demo/harness.json.' />);

    expect(screen.getByTestId("run-dialog-named-configuration-status").textContent)
      .toContain("openspec/changes/demo/harness.json");
  });

  it("offers only the configurations a change may be given, most effort first", () => {
    render(<RunDialog {...baseProps()} />);

    expect([...select().querySelectorAll("option")].map((option) => option.value))
      .toEqual(["thorough", "careful", "balanced", "economy"]);
  });

  it("says what the chosen configuration would set for the agents this change uses", () => {
    render(<RunDialog {...baseProps()} plan={plan({ stageAgents: [{ stage: "apply", agent: "codex-cli" }] })} />);

    fireEvent.change(select(), { target: { value: "thorough" } });

    expect(screen.getByTestId("run-dialog-named-configuration-description").textContent).toContain("codex-cli high");
  });

  it("says plainly when the agent takes no effort setting at all", () => {
    render(<RunDialog {...baseProps()} plan={plan({ stageAgents: [{ stage: "apply", agent: "gemini-cli" }] })} />);

    expect(screen.getByTestId("run-dialog-named-configuration-description").textContent).toContain("only the ceilings differ");
  });

  it("offers to put a recommended agent on every stage, and says what it wrote", () => {
    const group = (agent: string, medianCostUsd: number) => ({
      agent, runs: 6, completed: 6, enough: true, costSamples: 6,
      medianCostUsd, p90CostUsd: medianCostUsd, medianSeconds: 300, p90Seconds: 400,
    });
    const stats = {
      runs: 12,
      entriesRead: 24,
      entriesFromDeletedChanges: 0,
      enoughRuns: 5,
      byAgent: [group("claude-cli-acp", 1.5), group("codex-cli", 4)],
      byAgentAndEffort: [],
      runsWithEffort: 0,
    } as never;
    const onUseAgent = vi.fn();
    const props = baseProps();
    const { rerender } = render(<RunDialog {...props} stats={stats} onUseAgent={onUseAgent} />);

    fireEvent.click(screen.getByRole("button", { name: "Use claude-cli-acp for every stage" }));
    expect(onUseAgent).toHaveBeenCalledWith("claude-cli-acp");

    rerender(<RunDialog {...props} stats={stats} onUseAgent={onUseAgent} useAgentNote="Put claude-cli-acp on every stage." />);
    expect(screen.getByTestId("run-stats-use-agent-status").textContent).toContain("claude-cli-acp");
  });

  it("offers no such button where the host cannot write the change", () => {
    const stats = {
      runs: 12, entriesRead: 24, entriesFromDeletedChanges: 0, enoughRuns: 5,
      byAgent: [
        { agent: "claude-cli-acp", runs: 6, completed: 6, enough: true, costSamples: 6, medianCostUsd: 1.5, medianSeconds: 300 },
        { agent: "codex-cli", runs: 6, completed: 6, enough: true, costSamples: 6, medianCostUsd: 4, medianSeconds: 300 },
      ],
      byAgentAndEffort: [], runsWithEffort: 0,
    } as never;
    render(<RunDialog {...baseProps()} stats={stats} />);

    expect(screen.queryByRole("button", { name: /for every stage/u })).toBeNull();
  });
});

describe("RunDialog — asking for a run at a time", () => {
  // a-run-can-be-scheduled. "Now" and "at a time" are the same question,
  // asked once — which is why this lives in the dialog and not beside it.

  it("offers no schedule at all in a host that cannot keep one", () => {
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
    render(<RunDialog {...baseProps()} note="Scheduled for 09:00 — starting 3 hours late." />);

    expect(screen.getByTestId("run-dialog-note").textContent).toContain("3 hours late");
  });

  it("refuses a time it cannot read rather than throwing on the way to one", () => {
    // a-schedule-keeps-its-promise, task 6.3.
    const onSchedule = vi.fn();
    render(<RunDialog {...baseProps()} onSchedule={onSchedule} />);

    fireEvent.change(screen.getByLabelText("Start at"), { target: { value: "not-a-time" } });
    fireEvent.click(screen.getByTestId("run-dialog-schedule-chain"));

    expect(onSchedule).not.toHaveBeenCalled();
    expect(screen.getByTestId("run-dialog-schedule-problem").textContent).toContain("not a time this can read");
  });

  it("is a dialog with a name, and takes focus when it opened by itself", () => {
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
