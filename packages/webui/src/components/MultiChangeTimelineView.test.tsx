import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MultiChangeTimelineView } from "./MultiChangeTimelineView.js";
import type { ChangeTimeline } from "../change-timeline-client.js";

const rangeStart = "2026-01-01T00:00:00.000Z";
const rangeEnd = "2026-01-11T00:00:00.000Z";

const timelineA: ChangeTimeline = {
  changeName: "change-a",
  archived: true,
  createdDate: "2026-01-02T00:00:00.000Z",
  archivedDate: "2026-01-03",
  proposal: "",
  design: "",
  specs: [],
  tasks: [{ lineNumber: 0, text: "done task", done: true, date: "2026-01-02T12:00:00.000Z" }],
};

const timelineB: ChangeTimeline = {
  changeName: "change-b",
  archived: false,
  createdDate: "2026-01-05T00:00:00.000Z",
  archivedDate: null,
  proposal: "",
  design: "",
  specs: [],
  tasks: [{ lineNumber: 0, text: "pending task", done: false, date: null }],
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
