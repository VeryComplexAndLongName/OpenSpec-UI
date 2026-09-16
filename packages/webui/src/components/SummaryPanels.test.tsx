import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecentlyArchivedPanel, SpecsPanel } from "./SummaryPanels.js";

const specs = Array.from({ length: 8 }, (_, index) => ({ id: `spec-${index}`, requirementCount: 80 - index * 10 }));
const archived = Array.from({ length: 7 }, (_, index) => ({
  name: `2026-09-${String(10 + index).padStart(2, "0")}-change-${index}`,
  state: "archived" as const,
  completedTasks: index,
  totalTasks: 10,
}));
const recent = archived.slice(-5).reverse().map((change) => ({
  name: change.name,
  title: change.name.slice(11),
  completedTasks: change.completedTasks,
  totalTasks: change.totalTasks,
  day: change.name.slice(0, 10),
}));

// the-summary-looks-like-the-mockup 3.2
describe("SpecsPanel", () => {
  it("lists the specs it is given first, and every spec when asked", () => {
    render(<SpecsPanel top={specs.slice(0, 6)} all={specs} />);
    const panel = screen.getByTestId("summary-specs");

    expect(within(panel).getAllByRole("row")).toHaveLength(7);
    expect(panel).toHaveTextContent("by requirements");

    fireEvent.click(screen.getByTestId("summary-specs-all"));

    expect(within(panel).getAllByRole("row")).toHaveLength(9);
    expect(screen.getByTestId("summary-specs-all")).toHaveTextContent("The 6 with the most requirements");
  });

  it("says there are no specs, with no table under the head", () => {
    render(<SpecsPanel top={[]} all={[]} />);
    const panel = screen.getByTestId("summary-specs");

    expect(panel).toHaveTextContent("No specs yet.");
    expect(within(panel).queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("RecentlyArchivedPanel", () => {
  it("lists the five most recent with their tasks and day, and the whole archive with its search when asked", () => {
    render(<RecentlyArchivedPanel recent={recent} all={archived} />);
    const panel = screen.getByTestId("summary-archived");

    expect(panel).toHaveTextContent("7 in all");
    expect(within(panel).getAllByRole("row")).toHaveLength(6);
    expect(screen.getByTestId("summary-archived-2026-09-16-change-6")).toHaveTextContent("change-6");
    expect(screen.getByTestId("summary-archived-2026-09-16-change-6")).toHaveTextContent("6 / 10");
    expect(screen.getByTestId("summary-archived-2026-09-16-change-6")).toHaveTextContent("16 Sep");

    fireEvent.click(screen.getByTestId("summary-archived-all"));

    expect(screen.getByLabelText("Search archive")).toBeInTheDocument();
    expect(screen.getByTestId("archive-list").querySelectorAll("li")).toHaveLength(7);
  });

  it("says nothing is archived, with no table under the head", () => {
    render(<RecentlyArchivedPanel recent={[]} all={[]} />);
    const panel = screen.getByTestId("summary-archived");

    expect(panel).toHaveTextContent("Nothing archived yet.");
    expect(within(panel).queryByRole("table")).not.toBeInTheDocument();
  });
});
