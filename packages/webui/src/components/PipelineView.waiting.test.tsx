import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChangeReadiness, ChangeReadinessReport, WorktreeSurvey } from "@openspec-ui/core/browser";
import { PipelineView } from "./PipelineView.js";

// what-waits-for-a-person-is-a-dialog (ADR 0047): the owner, on 2026-10-09 -
// to see what blocks a run one scrolled to the bottom of the Pipeline, and
// nothing stopped one from going elsewhere while a question waited.

function change(changeName: string): ChangeReadiness {
  return { changeName, blockers: [], run: { state: "ready" }, capabilities: [], canJoin: [], blockedFrom: [] };
}

const load = async (): Promise<ChangeReadinessReport> => ({ changes: [change("alpha"), change("beta")] });
const survey = async (): Promise<WorktreeSurvey> => ({
  directories: [{
    path: "/repo",
    label: "repo",
    labelDeclared: false,
    isMain: true,
    isThis: true,
    branch: "main",
    runs: [],
    readable: true,
    authorDiffers: false,
    changes: [
      { changeName: "alpha", tasksDone: 0, tasksTotal: 1, blockers: [], alsoIn: [], openQuestions: [{ questionId: "Q-1", text: "CSV or vCard?" }, { questionId: "Q-2", text: "Which port?" }] },
      { changeName: "beta", tasksDone: 0, tasksTotal: 1, blockers: [], alsoIn: [] },
    ],
  }],
  runsElsewhere: [],
});

describe("PipelineView - what waits for a person", () => {
  it("says at the top what waits, and opens the answer as a modal dialog", async () => {
    const onAnswerQuestion = vi.fn();
    render(<PipelineView isActive load={load} survey={survey} onAnswerQuestion={onAnswerQuestion} />);

    const banner = await screen.findByTestId("pipeline-waiting");
    // Above the picture, not after it.
    const pipeline = screen.getByTestId("pipeline");
    const order = [...pipeline.querySelectorAll("[data-testid]")].map((element) => element.getAttribute("data-testid"));
    expect(order.indexOf("pipeline-waiting")).toBeLessThan(order.indexOf("pipeline-node-alpha"));
    expect(within(banner).getByTestId("pipeline-waiting-alpha")).toHaveTextContent("alpha asks 2 questions");
    expect(within(banner).queryByTestId("pipeline-waiting-beta")).toBeNull();

    fireEvent.click(within(banner).getByRole("button", { name: "Answer Questions for alpha" }));

    const dialog = screen.getByRole("dialog", { name: "Answer alpha" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Answer alpha: 2 questions");
    expect(screen.getByTestId("modal-layer")).toContainElement(dialog);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says nothing at the top where nothing waits", async () => {
    render(<PipelineView isActive load={load} />);
    await screen.findByTestId("pipeline-node-alpha");
    expect(screen.queryByTestId("pipeline-waiting")).toBeNull();
  });
});
