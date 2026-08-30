import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangesList } from "./ChangesList.js";
import type { ChangeSummary } from "../types.js";

const changes: ChangeSummary[] = [
  { name: "execution-core", state: "implemented", completedTasks: 20, totalTasks: 20, lastModified: "2026-08-03T08:35:35.471Z" },
  { name: "shared-ui", state: "in-progress", completedTasks: 4, totalTasks: 17 },
  { name: "vscode-extension", state: "draft", completedTasks: 0, totalTasks: 16 },
];

describe("ChangesList", () => {
  it("renders each change with its derived state label and progress", () => {
    render(<ChangesList changes={changes} />);

    expect(screen.getByTestId("change-execution-core")).toHaveTextContent("Implemented");
    expect(screen.getByTestId("change-execution-core")).toHaveTextContent("20/20 (100%)");
    expect(screen.getByTestId("change-shared-ui")).toHaveTextContent("In progress");
    expect(screen.getByTestId("change-shared-ui")).toHaveTextContent("4/17 (24%)");
    expect(screen.getByTestId("change-vscode-extension")).toHaveTextContent("Draft");
    expect(screen.getByTestId("change-vscode-extension")).toHaveTextContent("0/16 (0%)");
  });

  it("renders lastModified when present", () => {
    render(<ChangesList changes={changes} />);

    const time = screen.getByTestId("change-execution-core").querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-08-03T08:35:35.471Z");
    expect(screen.getByTestId("change-shared-ui").querySelector("time")).not.toBeInTheDocument();
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

  it("filters by name", () => {
    render(<ChangesList changes={changes} />);
    fireEvent.change(screen.getByLabelText("Search changes"), { target: { value: "shared" } });

    const items = screen.getByTestId("changes-list").querySelectorAll("li");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("shared-ui");
  });

  it("filters by status label", () => {
    render(<ChangesList changes={changes} />);
    fireEvent.change(screen.getByLabelText("Search changes"), { target: { value: "draft" } });

    const items = screen.getByTestId("changes-list").querySelectorAll("li");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("vscode-extension");
  });
});
