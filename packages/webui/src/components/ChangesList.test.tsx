import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangesList } from "./ChangesList.js";
import type { ChangeSummary } from "../types.js";

const changes: ChangeSummary[] = [
  { name: "execution-core", state: "implemented", completedTasks: 20, totalTasks: 20 },
  { name: "shared-ui", state: "in-progress", completedTasks: 4, totalTasks: 17 },
  { name: "vscode-extension", state: "draft", completedTasks: 0, totalTasks: 16 },
];

describe("ChangesList", () => {
  it("renders each change with its derived state label and progress", () => {
    render(<ChangesList changes={changes} />);

    expect(screen.getByTestId("change-execution-core")).toHaveTextContent("Implemented");
    expect(screen.getByTestId("change-execution-core")).toHaveTextContent("20/20");
    expect(screen.getByTestId("change-shared-ui")).toHaveTextContent("In progress");
    expect(screen.getByTestId("change-shared-ui")).toHaveTextContent("4/17");
    expect(screen.getByTestId("change-vscode-extension")).toHaveTextContent("Draft");
  });

  it("calls onSelect with the change name when clicked", () => {
    const onSelect = vi.fn();
    render(<ChangesList changes={changes} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId("change-shared-ui"));

    expect(onSelect).toHaveBeenCalledWith("shared-ui");
  });

  it("renders nothing but an empty list when there are no changes", () => {
    render(<ChangesList changes={[]} />);
    expect(screen.getByTestId("changes-list").children).toHaveLength(0);
  });
});
