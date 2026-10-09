import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CHANGE_ACTIONS, PIPELINE_CARD_REM, type ChangeActionId, type ChangeReadiness, type ChangeReadinessReport } from "@openspec-ui/core/browser";
import { PipelineView } from "./PipelineView.js";
import type { ChangeActionsHost } from "./CardActions.js";

// a-change-is-acted-on-from-its-card (ADR 0044): every action on a change, as
// icons under its name, from core's one list.

function change(changeName: string): ChangeReadiness {
  return { changeName, blockers: [], run: { state: "ready" }, capabilities: [], canJoin: [], blockedFrom: [] };
}

const load = async (): Promise<ChangeReadinessReport> => ({ changes: [change("alpha"), change("beta")] });

function host(offered: readonly ChangeActionId[] = CHANGE_ACTIONS.map((entry) => entry.id)): ChangeActionsHost & { perform: ReturnType<typeof vi.fn> } {
  return { offered: new Set(offered), perform: vi.fn() };
}

describe("PipelineView - a change is acted on from its card", () => {
  it("draws every action but Run Change, which is the card's Start, in two rows of groups", async () => {
    render(<PipelineView isActive load={load} changeActions={host()} />);

    const bar = await screen.findByTestId("pipeline-node-alpha-actions");
    expect(bar).toHaveAttribute("role", "toolbar");
    const rows = bar.querySelectorAll(".openspec-pipeline-node-actions-row");
    expect(rows).toHaveLength(2);
    expect([...rows[0]!.querySelectorAll(".openspec-pipeline-node-actions-group")].map((group) => group.getAttribute("data-group"))).toEqual(["run", "inspect"]);
    expect([...rows[1]!.querySelectorAll(".openspec-pipeline-node-actions-group")].map((group) => group.getAttribute("data-group"))).toEqual(["set-up", "danger"]);
    expect(within(bar).getAllByRole("button")).toHaveLength(CHANGE_ACTIONS.length - 1);
    expect(screen.queryByTestId("pipeline-action-runChange-alpha")).toBeNull();
    expect(screen.getByTestId("pipeline-action-configureChangeHarness-alpha")).toHaveAccessibleName("Configure Change Harness alpha");
  });

  it("says why an action cannot run now, and does nothing when it is pressed", async () => {
    const actions = host();
    render(<PipelineView isActive load={load} changeActions={actions} />);

    const open = await screen.findByTestId("pipeline-action-openWorktree-alpha");
    expect(open).toHaveAttribute("aria-disabled", "true");
    expect(open).toHaveAttribute("title", "Open Worktree: This change is worked in this checkout.");
    fireEvent.click(open);
    expect(actions.perform).not.toHaveBeenCalled();
  });

  it("runs an action at once, naming the change", async () => {
    const actions = host();
    render(<PipelineView isActive load={load} changeActions={actions} />);

    fireEvent.click(await screen.findByTestId("pipeline-action-validateChange-beta"));

    expect(actions.perform).toHaveBeenCalledWith("validateChange", "beta", { confirmed: false });
  });

  it("asks before a Danger action, saying what it does, and runs it only when confirmed", async () => {
    const actions = host();
    render(<PipelineView isActive load={load} changeActions={actions} />);

    fireEvent.click(await screen.findByTestId("pipeline-action-deleteChange-alpha"));
    const form = screen.getByTestId("pipeline-confirm-action");
    expect(form).toHaveAccessibleName("Delete Change alpha");
    expect(form).toHaveTextContent("This cannot be undone.");
    fireEvent.click(screen.getByTestId("pipeline-confirm-action-no"));
    expect(actions.perform).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pipeline-confirm-action")).toBeNull();

    fireEvent.click(screen.getByTestId("pipeline-action-deleteChange-alpha"));
    fireEvent.click(screen.getByTestId("pipeline-confirm-action-yes"));
    expect(actions.perform).toHaveBeenCalledWith("deleteChange", "alpha", { confirmed: true });
  });

  it("draws only what the host performs, and makes a card exactly as much taller as its rows", async () => {
    const { unmount } = render(<PipelineView isActive load={load} />);
    await screen.findByTestId("pipeline-node-alpha");
    expect(screen.queryByTestId("pipeline-node-alpha-actions")).toBeNull();
    const plain = Number(screen.getByTestId("pipeline-node-alpha").style.getPropertyValue("--h"));
    unmount();

    render(<PipelineView isActive load={load} changeActions={host(["validateChange", "showDiff"])} />);
    const bar = await screen.findByTestId("pipeline-node-alpha-actions");
    expect(within(bar).getAllByRole("button").map((button) => button.getAttribute("data-testid"))).toEqual([
      "pipeline-action-validateChange-alpha",
      "pipeline-action-showDiff-alpha",
    ]);
    const r = PIPELINE_CARD_REM;
    expect(Number(screen.getByTestId("pipeline-node-alpha").style.getPropertyValue("--h"))).toBe(plain + r.actionsGap + r.actionsRow);
  });
});
