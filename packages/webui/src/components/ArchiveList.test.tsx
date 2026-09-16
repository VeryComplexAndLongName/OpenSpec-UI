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

  // the-summary-looks-like-the-mockup 2.3: "done / total" and the day the
  // change was archived, as the "Recently archived" panel draws them — no
  // bar, which in a half-width panel ran into the day.
  it("renders task progress as done / total with no bar, and the day", () => {
    const partial: ChangeSummary[] = [
      { name: "2026-09-16-shared-ui", state: "archived", completedTasks: 4, totalTasks: 17, lastModified: "2026-08-01T00:00:00.000Z" },
    ];
    render(<ArchiveList changes={partial} />);
    expect(screen.getByTestId("archive-2026-09-16-shared-ui")).toHaveTextContent(/^shared-ui/u);
    expect(screen.getByTitle("2026-09-16-shared-ui")).toBeInTheDocument();
    expect(screen.getByTestId("archive-2026-09-16-shared-ui")).toHaveTextContent("4 / 17");
    expect(screen.getByTestId("archive-2026-09-16-shared-ui")).toHaveTextContent("16 Sep");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("wraps the list in a height-bounded, scrollable container", () => {
    render(<ArchiveList changes={changes} />);

    const container = screen.getByTestId("archive-list").parentElement;
    expect(container).toHaveStyle({ overflowY: "auto" });
    expect(container?.style.maxHeight.length).toBeGreaterThan(0);
  });
});
