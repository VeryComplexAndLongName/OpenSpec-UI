import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TasksChecklist } from "./TasksChecklist.js";
import type { TaskItem } from "../types.js";

const tasks: TaskItem[] = [
  { id: "1", description: "Define protocol types", done: true },
  { id: "2", description: "Write contract test", done: false },
  { id: "3", description: "Implement adapter", done: false },
];

describe("TasksChecklist", () => {
  it("shows completed/total progress", () => {
    render(<TasksChecklist tasks={tasks} />);
    expect(screen.getByTestId("tasks-progress")).toHaveTextContent("1/3 complete");
  });

  it("renders a Run button only for incomplete tasks", () => {
    render(<TasksChecklist tasks={tasks} />);
    expect(screen.queryByTestId("run-task-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("run-task-2")).toBeInTheDocument();
    expect(screen.getByTestId("run-task-3")).toBeInTheDocument();
  });

  it("calls onRunTask with the specific task when Run is clicked", () => {
    const onRunTask = vi.fn();
    render(<TasksChecklist tasks={tasks} onRunTask={onRunTask} />);
    fireEvent.click(screen.getByTestId("run-task-2"));
    expect(onRunTask).toHaveBeenCalledWith(tasks[1]);
  });

  it("marks done tasks distinctly", () => {
    render(<TasksChecklist tasks={tasks} />);
    const items = screen.getByTestId("tasks-list").querySelectorAll("li");
    expect(items[0]?.className).toContain("openspec-task--done");
    expect(items[1]?.className).toContain("openspec-task--pending");
  });
});
