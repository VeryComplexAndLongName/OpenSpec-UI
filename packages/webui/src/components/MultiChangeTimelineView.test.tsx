import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MultiChangeTimelineView } from "./MultiChangeTimelineView.js";
import type { ChangeTimeline } from "../change-timeline-client.js";

const rangeStart = "2026-01-01T00:00:00.000Z";
const rangeEnd = "2026-01-11T00:00:00.000Z";

const timelineA: ChangeTimeline = {
  changeName: "change-a",
  archived: true,
  dates: {
    proposed: { date: null, day: null, source: "none" },
    firstWorked: { date: null, day: null, source: "none" },
    lastWorked: { date: null, day: null, source: "none" },
    archived: { date: null, day: null, source: "none" },
  },
  createdDate: "2026-01-02T00:00:00.000Z",
  archivedDate: "2026-01-03",
  proposal: "",
  design: "",
  specs: [],
  tasks: [
    {
      lineNumber: 0,
      text: "done task",
      done: true,
      date: "2026-01-02T12:00:00.000Z",
      lastTouchedDate: "2026-01-02T12:00:00.000Z",
    },
  ],
};

const timelineB: ChangeTimeline = {
  changeName: "change-b",
  archived: false,
  dates: {
    proposed: { date: null, day: null, source: "none" },
    firstWorked: { date: null, day: null, source: "none" },
    lastWorked: { date: null, day: null, source: "none" },
    archived: { date: null, day: null, source: "none" },
  },
  createdDate: "2026-01-05T00:00:00.000Z",
  archivedDate: null,
  proposal: "",
  design: "",
  specs: [],
  tasks: [{ lineNumber: 0, text: "pending task", done: false, date: null, lastTouchedDate: null }],
};

describe("MultiChangeTimelineView", () => {
  it("renders one lane per timeline", () => {
    render(<MultiChangeTimelineView timelines={[timelineA, timelineB]} rangeStart={rangeStart} rangeEnd={rangeEnd} />);

    expect(screen.getByTestId("multi-timeline-lane-change-a")).toBeInTheDocument();
    expect(screen.getByTestId("multi-timeline-lane-change-b")).toBeInTheDocument();
  });

  it("plots created, task, and archived points for an archived change", () => {
    render(<MultiChangeTimelineView timelines={[timelineA]} rangeStart={rangeStart} rangeEnd={rangeEnd} />);

    const lane = screen.getByTestId("multi-timeline-lane-change-a");
    expect(lane.querySelectorAll(".openspec-multi-timeline-point-created")).toHaveLength(1);
    expect(lane.querySelectorAll(".openspec-multi-timeline-point-task")).toHaveLength(1);
    expect(lane.querySelectorAll(".openspec-multi-timeline-point-archived")).toHaveLength(1);
  });

  it("plots only a created point for an active change with no completed tasks", () => {
    render(<MultiChangeTimelineView timelines={[timelineB]} rangeStart={rangeStart} rangeEnd={rangeEnd} />);

    const lane = screen.getByTestId("multi-timeline-lane-change-b");
    expect(lane.querySelectorAll(".openspec-multi-timeline-point-created")).toHaveLength(1);
    expect(lane.querySelectorAll(".openspec-multi-timeline-point-task")).toHaveLength(0);
    expect(lane.querySelectorAll(".openspec-multi-timeline-point-archived")).toHaveLength(0);
  });

  it("positions the range start and end labels", () => {
    render(<MultiChangeTimelineView timelines={[timelineA]} rangeStart={rangeStart} rangeEnd={rangeEnd} />);
    expect(screen.getByText(new Date(rangeStart).toLocaleDateString())).toBeInTheDocument();
    expect(screen.getByText(new Date(rangeEnd).toLocaleDateString())).toBeInTheDocument();
  });

  it("shows a message when no changes are selected", () => {
    render(<MultiChangeTimelineView timelines={[]} rangeStart={rangeStart} rangeEnd={rangeEnd} />);
    expect(screen.getByText("No changes selected.")).toBeInTheDocument();
  });
});

describe("MultiChangeTimelineView — when a change was archived", () => {
  // charts-over-what-happened. The end-of-day anchor existed because the
  // only archiving date available was a calendar date read off the
  // folder name; a commit carries a time of day, so it plots where it
  // happened.

  function archivedAt(date: string | null, source: "git-commit" | "folder-name"): ChangeTimeline {
    return {
      changeName: "archived-change",
      archived: true,
      dates: {
        proposed: { date: null, day: null, source: "none" },
        firstWorked: { date: null, day: null, source: "none" },
        lastWorked: { date: null, day: null, source: "none" },
        archived: { date, day: date?.slice(0, 10) ?? null, source },
      },
      createdDate: null,
      archivedDate: "2026-01-03",
      proposal: "",
      design: "",
      specs: [],
      tasks: [],
    };
  }

  /** Where the one point on the lane sits, as the component placed it. */
  function pointPosition(timeline: ChangeTimeline): string {
    const { container } = render(
      <MultiChangeTimelineView timelines={[timeline]} rangeStart={rangeStart} rangeEnd={rangeEnd} />,
    );
    const point = container.querySelector(".openspec-multi-timeline-point-archived") as HTMLElement;
    return point.style.left;
  }

  it("plots the archiving where the commit that did it happened", () => {
    const fromCommit = pointPosition(archivedAt("2026-01-03T06:00:00.000Z", "git-commit"));
    const fromFolderName = pointPosition(archivedAt("2026-01-03T00:00:00.000Z", "folder-name"));

    // Six in the morning is not the end of that day, and the lane shows
    // the difference now.
    expect(fromCommit).not.toBe(fromFolderName);
  });

  it("keeps the end-of-day anchor where only the folder name answered", () => {
    // Midnight would plot archiving before that same day's task ticks,
    // which is the case the anchor was written for.
    const fromFolderName = pointPosition(archivedAt("2026-01-03T00:00:00.000Z", "folder-name"));
    const endOfDay = pointPosition({
      ...archivedAt("2026-01-03T23:59:59.999Z", "git-commit"),
    });

    expect(fromFolderName).toBe(endOfDay);
  });
});
