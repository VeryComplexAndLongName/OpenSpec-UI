import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangeTimelineView } from "./ChangeTimelineView.js";
import type { ChangeTimeline, ChangeTimelineTask } from "../change-timeline-client.js";

// the-change-timeline-looks-like-the-mockup 2.4: the mockup's one-change
// screen. What is derived is timeline-moments.test.ts's; this asserts what is
// drawn from it.

const ZONE = "Europe/Moscow";

function task(lineNumber: number, text: string, partial: Partial<ChangeTimelineTask> = {}): ChangeTimelineTask {
  return { lineNumber, text, done: true, date: null, lastTouchedDate: null, ...partial };
}

const SQUASHED = "2026-09-13T20:16:00.000Z";

/** An archived change: five tasks in one commit, one on its own, one done
 * with no date, and one still open. */
const timeline: ChangeTimeline = {
  changeName: "2026-09-14-a-run-says-which-task-it-is-on",
  archived: true,
  dates: {
    proposed: { date: "2026-09-13T15:40:00.000Z", day: "2026-09-13", source: "git-commit" },
    firstWorked: { date: SQUASHED, day: "2026-09-13", source: "git-blame" },
    lastWorked: { date: "2026-09-14T01:47:00.000Z", day: "2026-09-14", source: "git-blame" },
    archived: { date: "2026-09-14T01:47:00.000Z", day: "2026-09-14", source: "git-commit" },
  },
  createdDate: "2026-09-13T15:40:00.000Z",
  archivedDate: "2026-09-14",
  proposal: "## Why\n\nBecause reasons.\n",
  design: "## Context\n\nSome context.\n",
  specs: [{ specId: "execution-core", content: "## ADDED Requirements\n" }],
  tasks: [
    task(1, "1.1 commandInstruction in the shared agent instructions", { date: SQUASHED }),
    task(2, "1.2 shared.test.ts pins the instruction", { date: SQUASHED }),
    task(3, "2.1 A new file, task-marker.ts, exports a pure parser", { date: SQUASHED }),
    task(4, "2.2 The parser reads a number", { date: SQUASHED }),
    task(5, "2.3 The parser reads a guess", { date: SQUASHED }),
    task(8, "6.2 Run `npm run verify` unpiped, after the last edit", { date: "2026-09-13T21:13:00.000Z", continued: "and with the lints." }),
    task(9, "6.3 Recorded without a commit"),
    task(10, "6.7 Whether the card reads well", { done: false, lastTouchedDate: "2026-09-01T00:00:00.000Z" }),
  ],
};

function draw(props: Partial<Parameters<typeof ChangeTimelineView>[0]> = {}) {
  return render(<ChangeTimelineView timeline={timeline} timeZone={ZONE} now={new Date("2026-09-17T12:00:00.000Z")} {...props} />);
}

describe("ChangeTimelineView — Tasks over time", () => {
  it("places the proposal, each moment and the archive on the rail, oldest first, in local times", () => {
    draw();
    const rail = within(screen.getByTestId("change-timeline-moments"));
    expect(rail.getByText("times are local")).toBeInTheDocument();
    const moments = screen.getByTestId("change-timeline-tasks").querySelectorAll(":scope > li");
    expect([...moments].map((moment) => moment.querySelector("time")?.textContent)).toEqual([
      "Sun 13 Sep, 18:40",
      "Sun 13 Sep, 23:16",
      "Mon 14 Sep, 00:13",
      "Mon 14 Sep, 04:47",
    ]);
    expect(moments[0]).toHaveTextContent("Proposedproposal.md first committed");
    // The whole sentence, wrapped lines and all, without its Markdown marks,
    // and the same on hover where one line cuts it.
    expect(moments[2]).toHaveTextContent("6.2Run npm run verify unpiped, after the last edit and with the lints.");
    expect(within(moments[2] as HTMLElement).getByTitle("Run npm run verify unpiped, after the last edit and with the lints.")).toBeInTheDocument();
    expect(moments[3]).toHaveTextContent("Archivedmoved to archive/2026-09-14-a-run-says-which-task-it-is-on");
  });

  it("draws tasks ticked in one commit as one moment with its first three, and opens it whole", () => {
    draw();
    expect(screen.getByTestId("timeline-group-toggle-1")).toHaveTextContent("5 tasks ticked in one commit");
    const group = screen.getByTestId("timeline-group-1");
    expect(group.querySelectorAll("[data-testid^='timeline-task-']")).toHaveLength(3);
    expect(screen.getByTestId("timeline-group-more-1")).toHaveTextContent("and 2 more");

    fireEvent.click(screen.getByTestId("timeline-group-more-1"));
    expect(screen.getByTestId("timeline-group-1").querySelectorAll("[data-testid^='timeline-task-']")).toHaveLength(5);
    expect(screen.queryByTestId("timeline-group-more-1")).toBeNull();
  });

  it("closes a moment's list and opens it again", () => {
    draw();
    const toggle = screen.getByTestId("timeline-group-toggle-1");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("timeline-group-1")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId("timeline-group-1")).toBeInTheDocument();
  });

  it("says so when git gives the change no times", () => {
    const none = { date: null, day: null, source: "none" as const };
    draw({ timeline: { ...timeline, archived: false, dates: { proposed: none, firstWorked: none, lastWorked: none, archived: none }, tasks: [] } });
    expect(screen.getByTestId("change-timeline-moments")).toHaveTextContent("Git gives this change no times yet.");
  });
});

describe("ChangeTimelineView — the tile and the dates", () => {
  it("gives done of total and the span from proposal to archive", () => {
    draw();
    const tile = screen.getByTestId("change-timeline-tile");
    expect(tile).toHaveTextContent("Tasks");
    expect(tile).toHaveTextContent("7 / 8");
    expect(tile).toHaveTextContent("proposed to archived in 10 h 07 min");
    expect(tile).not.toHaveClass("openspec-change-timeline-tile--done");
  });

  it("gives each date with where it was read from, and why tasks share a moment", () => {
    draw();
    expect(screen.getByTestId("timeline-date-proposed")).toHaveTextContent("Sun 13 Sep, 18:40from a git commit");
    expect(screen.getByTestId("timeline-date-last-worked")).toHaveTextContent("Mon 14 Sep, 04:47from git blame on tasks.md");
    expect(screen.getByTestId("timeline-date-archived")).toHaveTextContent("from a git commit");
    expect(screen.getByTestId("change-timeline-shared-note")).toHaveTextContent("which is why 5 share one moment");
  });

  it("has no shared-moment note when every moment holds one task", () => {
    draw({ timeline: { ...timeline, tasks: timeline.tasks.slice(5) } });
    expect(screen.queryByTestId("change-timeline-shared-note")).toBeNull();
  });
});

describe("ChangeTimelineView — what the rail cannot place", () => {
  it("lists open tasks, marks one stale by the threshold, and lists done tasks with no date", () => {
    draw({ staleThresholdDays: 14 });
    const open = screen.getByTestId("change-timeline-open");
    expect(open).toHaveTextContent("6.7Whether the card reads well");
    expect(within(open).getByText("Stale")).toBeInTheDocument();
    expect(screen.getByTestId("change-timeline-undated")).toHaveTextContent("6.3Recorded without a commit");
  });

  it("follows the threshold it is given", () => {
    draw({ staleThresholdDays: 30 });
    expect(within(screen.getByTestId("change-timeline-open")).queryByText("Stale")).toBeNull();
  });

  it("keeps the proposal, design and specs, closed until asked for", () => {
    draw();
    const proposal = screen.getByTestId("timeline-document-proposal");
    expect(proposal.tagName).toBe("DETAILS");
    expect(proposal).not.toHaveAttribute("open");
    expect(proposal).toHaveTextContent("Because reasons.");
    expect(screen.getByTestId("timeline-document-design")).toHaveTextContent("Some context.");
    expect(screen.getByTestId("timeline-document-spec-execution-core")).toHaveTextContent("Spec: execution-core");
  });

  it("draws no section with nothing to list", () => {
    draw({ timeline: { ...timeline, proposal: "", design: "", specs: [], tasks: timeline.tasks.slice(0, 6) } });
    expect(screen.queryByTestId("change-timeline-open")).toBeNull();
    expect(screen.queryByTestId("change-timeline-undated")).toBeNull();
    expect(screen.queryByTestId("change-timeline-documents")).toBeNull();
    expect(screen.getByTestId("change-timeline-tile")).toHaveClass("openspec-change-timeline-tile--done");
  });
});

describe("ChangeTimelineView — the heading", () => {
  it("names the change only when asked, without its archive prefix", () => {
    const { unmount } = draw();
    expect(screen.queryByTestId("change-timeline-heading")).toBeNull();
    unmount();

    draw({ heading: true });
    const heading = screen.getByTestId("change-timeline-heading");
    expect(within(heading).getByRole("heading", { level: 2 })).toHaveTextContent("a-run-says-which-task-it-is-on");
    expect(heading).toHaveTextContent("Archived · each task placed when git shows it was ticked");
  });
});
