import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MultiChangeTimelineView, dayKey, daysOf } from "./MultiChangeTimelineView.js";
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

/** The grid column a point was placed in, as the component set it. */
function columnOf(element: Element | null | undefined): string {
  return (element as HTMLElement | null | undefined)?.style.gridColumn ?? "";
}

describe("MultiChangeTimelineView", () => {
  it("renders one row per timeline", () => {
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

  it("runs a column for every day of the range", () => {
    const { container } = render(
      <MultiChangeTimelineView timelines={[timelineA]} rangeStart={rangeStart} rangeEnd={rangeEnd} />,
    );

    const days = container.querySelectorAll(".openspec-multi-timeline-day");
    expect(days).toHaveLength(daysOf(rangeStart, rangeEnd).length);
    expect(days[0]?.getAttribute("data-day")).toBe(dayKey(rangeStart));
    expect(days[days.length - 1]?.getAttribute("data-day")).toBe(dayKey(rangeEnd));
  });

  it("shows a message when no changes are selected", () => {
    render(<MultiChangeTimelineView timelines={[]} rangeStart={rangeStart} rangeEnd={rangeEnd} />);
    expect(screen.getByText("No changes selected.")).toBeInTheDocument();
  });
});

// the-web-ui-screens-wear-metro 2.4: a position on this picture is a date,
// which is what the log-scaled lane it replaces could not say.
describe("MultiChangeTimelineView — an event sits in the column of its day", () => {
  it("puts an event in the column of the day it happened", () => {
    const { container } = render(
      <MultiChangeTimelineView timelines={[timelineA]} rangeStart={rangeStart} rangeEnd={rangeEnd} />,
    );

    const task = container.querySelector(".openspec-multi-timeline-point-task");
    const taskDay = dayKey("2026-01-02T12:00:00.000Z");
    const expected = daysOf(rangeStart, rangeEnd).indexOf(taskDay) + 2;

    expect(task?.getAttribute("data-day")).toBe(taskDay);
    expect(columnOf(task)).toBe(String(expected));
  });

  it("gives two changes with the same date the same column", () => {
    const sameDay: ChangeTimeline = { ...timelineB, changeName: "change-c", createdDate: timelineA.createdDate };
    const { container } = render(
      <MultiChangeTimelineView timelines={[timelineA, sameDay]} rangeStart={rangeStart} rangeEnd={rangeEnd} />,
    );

    const [first, second] = [...container.querySelectorAll(".openspec-multi-timeline-point-created")];
    expect(columnOf(first)).toBe(columnOf(second));
    expect(columnOf(first)).not.toBe("");
  });

  it("leaves out an event that falls outside the range", () => {
    const outside: ChangeTimeline = { ...timelineB, createdDate: "2025-12-01T00:00:00.000Z" };
    render(<MultiChangeTimelineView timelines={[outside]} rangeStart={rangeStart} rangeEnd={rangeEnd} />);

    const lane = screen.getByTestId("multi-timeline-lane-change-b");
    expect(lane.querySelectorAll(".openspec-multi-timeline-point")).toHaveLength(0);
  });
});

describe("MultiChangeTimelineView — when a change was archived", () => {
  // charts-over-what-happened. The end-of-day anchor existed because the
  // only archiving date available was a calendar date read off the folder
  // name. On a day grid both land in the same column, which is the point:
  // the picture answers "which day", and the tooltip keeps the time.

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

  function archivedPoint(timeline: ChangeTimeline): HTMLElement {
    const { container } = render(
      <MultiChangeTimelineView timelines={[timeline]} rangeStart={rangeStart} rangeEnd={rangeEnd} />,
    );
    return container.querySelector(".openspec-multi-timeline-point-archived") as HTMLElement;
  }

  it("puts a commit-timed archiving in that day's column", () => {
    const point = archivedPoint(archivedAt("2026-01-03T06:00:00.000Z", "git-commit"));

    expect(point.getAttribute("data-day")).toBe(dayKey("2026-01-03T06:00:00.000Z"));
  });

  it("keeps the time of day in the title, which the column cannot carry", () => {
    const point = archivedPoint(archivedAt("2026-01-03T06:00:00.000Z", "git-commit"));

    expect(point.getAttribute("title")).toContain(new Date("2026-01-03T06:00:00.000Z").toLocaleString());
  });
});
