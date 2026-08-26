import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangeTimelineView } from "./ChangeTimelineView.js";
import type { ChangeTimeline } from "../change-timeline-client.js";

const timeline: ChangeTimeline = {
  changeName: "my-change",
  archived: true,
  createdDate: "2026-01-01T00:00:00.000Z",
  archivedDate: "2026-01-03",
  proposal: "## Why\n\nBecause reasons.\n",
  design: "## Context\n\nSome context.\n",
  specs: [{ specId: "execution-core", content: "## ADDED Requirements\n" }],
  tasks: [
    {
      lineNumber: 0,
      text: "second task, checked later",
      done: true,
      date: "2026-01-03T00:00:00.000Z",
      lastTouchedDate: "2026-01-03T00:00:00.000Z",
    },
    {
      lineNumber: 1,
      text: "first task, checked earlier",
      done: true,
      date: "2026-01-02T00:00:00.000Z",
      lastTouchedDate: "2026-01-02T00:00:00.000Z",
    },
    {
      lineNumber: 2,
      text: "still pending",
      done: false,
      date: null,
      lastTouchedDate: "2026-01-10T00:00:00.000Z",
    },
  ],
};

describe("ChangeTimelineView", () => {
  it("renders the change name and both dates for an archived change", () => {
    render(<ChangeTimelineView timeline={timeline} />);
    const view = screen.getByTestId("change-timeline-view");
    expect(view).toHaveTextContent("my-change");
    expect(view).toHaveTextContent("2026-01-03");
  });

  it("renders proposal, design, and spec content", () => {
    render(<ChangeTimelineView timeline={timeline} />);
    const view = screen.getByTestId("change-timeline-view");
    expect(view).toHaveTextContent("Because reasons.");
    expect(view).toHaveTextContent("Some context.");
    expect(view).toHaveTextContent("execution-core");
  });

  it("orders tasks oldest-dated first, then pending", () => {
    render(<ChangeTimelineView timeline={timeline} />);
    const items = screen.getByTestId("change-timeline-tasks").querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("first task, checked earlier");
    expect(items[1]).toHaveTextContent("second task, checked later");
    expect(items[2]).toHaveTextContent("still pending");
  });

  it("expands a task's full text on click", () => {
    render(<ChangeTimelineView timeline={timeline} />);
    const toggle = screen.getByTestId("timeline-task-2").querySelector("button");
    if (!toggle) throw new Error("task toggle button not found");

    expect(screen.getByTestId("timeline-task-2").querySelectorAll("p")).toHaveLength(0);
    fireEvent.click(toggle);
    expect(screen.getByTestId("timeline-task-2").querySelectorAll("p")).toHaveLength(1);
  });

  it("shows nothing for an empty task list", () => {
    render(<ChangeTimelineView timeline={{ ...timeline, tasks: [] }} />);
    expect(screen.getByText("No tasks found.")).toBeInTheDocument();
  });

  it("flags a pending task as stale once it has sat untouched past the threshold", () => {
    render(
      <ChangeTimelineView
        timeline={timeline}
        staleThresholdDays={14}
        now={new Date("2026-02-01T00:00:00.000Z")} // 22 days after the pending task's lastTouchedDate
      />,
    );
    const pendingTask = screen.getByTestId("timeline-task-2");
    expect(pendingTask.className).toContain("openspec-timeline-task-stale");
    expect(pendingTask).toHaveTextContent("stale");
  });

  it("does not flag a pending task touched recently", () => {
    render(
      <ChangeTimelineView
        timeline={timeline}
        staleThresholdDays={14}
        now={new Date("2026-01-11T00:00:00.000Z")} // 1 day after the pending task's lastTouchedDate
      />,
    );
    const pendingTask = screen.getByTestId("timeline-task-2");
    expect(pendingTask.className).not.toContain("openspec-timeline-task-stale");
    expect(pendingTask).toHaveTextContent("pending");
    expect(pendingTask).not.toHaveTextContent("stale");
  });
});
