import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArchiveList } from "./ArchiveList.js";
import type { ChangeSummary } from "../types.js";

const changes: ChangeSummary[] = [
  { name: "execution-core", state: "archived", completedTasks: 20, totalTasks: 20, lastModified: "2026-08-01T00:00:00.000Z" },
  { name: "reranker-infrastructure", state: "archived", completedTasks: 5, totalTasks: 5, lastModified: "2026-07-15T00:00:00.000Z" },
];

describe("ArchiveList", () => {
  it("renders all changes sorted by most recent first", () => {
    render(<ArchiveList changes={changes} />);
    const items = screen.getByTestId("archive-list").querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("execution-core");
    expect(items[1]).toHaveTextContent("reranker-infrastructure");
  });

  it("filters by search query", () => {
    render(<ArchiveList changes={changes} />);
    fireEvent.change(screen.getByLabelText("Search archive"), { target: { value: "reranker" } });

    const items = screen.getByTestId("archive-list").querySelectorAll("li");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("reranker-infrastructure");
  });

  it("calls onSelect when a change is clicked", () => {
    const onSelect = vi.fn();
    render(<ArchiveList changes={changes} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("archive-execution-core"));
    expect(onSelect).toHaveBeenCalledWith("execution-core");
  });

  it("shows no results for a query matching nothing", () => {
    render(<ArchiveList changes={changes} />);
    fireEvent.change(screen.getByLabelText("Search archive"), { target: { value: "does-not-exist" } });
    expect(screen.getByTestId("archive-list").querySelectorAll("li")).toHaveLength(0);
  });

  it("filters by status label", () => {
    render(<ArchiveList changes={changes} />);
    fireEvent.change(screen.getByLabelText("Search archive"), { target: { value: "archived" } });

    const items = screen.getByTestId("archive-list").querySelectorAll("li");
    expect(items).toHaveLength(2);
  });

  it("renders task progress with a percentage", () => {
    const partial: ChangeSummary[] = [
      { name: "shared-ui", state: "archived", completedTasks: 4, totalTasks: 17, lastModified: "2026-08-01T00:00:00.000Z" },
    ];
    render(<ArchiveList changes={partial} />);
    expect(screen.getByTestId("archive-shared-ui")).toHaveTextContent("4/17 (24%)");
  });
});
