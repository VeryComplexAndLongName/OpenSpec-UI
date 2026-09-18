import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  comparisonRows,
  comparisonWindow,
  type ChangeSpan,
  type DatedFact,
} from "@openspec-ui/core/browser";
import { ChangeComparisonView } from "./ChangeComparisonView.js";
import type { ChangeTimeline } from "../change-timeline-client.js";

/** A local instant, as the grid reads one. */
function at(month: number, day: number, hour = 0, minute = 0): number {
  return new Date(2026, month - 1, day, hour, minute, 0, 0).getTime();
}

function fact(ms: number | null): DatedFact {
  if (ms === null) return { date: null, day: null, source: "none" };
  const date = new Date(ms);
  return { date: date.toISOString(), day: date.toISOString().slice(0, 10), source: "git-commit" };
}

function span(
  changeName: string,
  proposed: number | null,
  archived: number | null,
  tasks: { done: number; total: number } | null = { done: 4, total: 4 },
): ChangeSpan {
  return {
    changeName,
    archived: archived !== null,
    dates: { proposed: fact(proposed), archived: fact(archived) },
    tasks,
  };
}

const NOW = at(9, 16, 16, 15);
const SPANS = [
  span("2026-09-13-first-change", at(9, 12, 12, 0), at(9, 13, 12, 0), { done: 47, total: 47 }),
  span("second-change", at(9, 14, 9, 0), null, { done: 25, total: 27 }),
];

function view(overrides: Partial<Parameters<typeof ChangeComparisonView>[0]> = {}, filter = "") {
  const window = comparisonWindow("5-days", SPANS, NOW);
  const rows = comparisonRows(SPANS, window, NOW, filter);
  const props = {
    window,
    rows,
    total: comparisonRows(SPANS, window, NOW).length,
    period: "5-days" as const,
    onPeriod: vi.fn(),
    filter,
    onFilter: vi.fn(),
    now: NOW,
    onOpen: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ChangeComparisonView {...props} />) };
}

const timeline: ChangeTimeline = {
  changeName: "2026-09-13-first-change",
  archived: true,
  dates: {
    proposed: fact(at(9, 12, 12, 0)),
    firstWorked: fact(at(9, 12, 18, 0)),
    lastWorked: fact(at(9, 13, 10, 0)),
    archived: fact(at(9, 13, 12, 0)),
  },
  createdDate: new Date(at(9, 12, 12, 0)).toISOString(),
  archivedDate: "2026-09-13",
  proposal: "",
  design: "",
  specs: [],
  tasks: [],
};

describe("ChangeComparisonView", () => {
  it("draws one row per change, with the days it covers", () => {
    view();

    expect(screen.getByTestId("comparison-row-2026-09-13-first-change")).toBeInTheDocument();
    expect(screen.getByTestId("comparison-row-second-change")).toBeInTheDocument();
    expect(screen.getByTestId("comparison-day-2026-09-12")).toHaveTextContent("Sat 12 Sep");
    expect(screen.getByTestId("comparison-day-2026-09-16")).toHaveTextContent("Wed 16 Sep");
  });

  it("places each bar where core said, and cuts none of these", () => {
    view();

    const bar = screen.getByTestId("comparison-bar-2026-09-13-first-change");
    expect(bar.style.getPropertyValue("--from")).toBe("10%");
    expect(bar.style.getPropertyValue("--to")).toBe("30%");
    expect(bar).not.toHaveAttribute("data-clipped-start");
    // The active change's bar ends where the dashed line is.
    const active = screen.getByTestId("comparison-bar-second-change");
    expect(active.style.getPropertyValue("--to"))
      .toBe(screen.getByTestId("comparison-now").style.getPropertyValue("--at"));
  });

  it("names a row by its change, its state, its dates and its figures, without the picture", () => {
    const { props } = view();

    const row = screen.getByTestId("comparison-row-second-change");
    expect(row).toHaveAccessibleName("second-change, active, proposed Mon 14 Sep, 09:00, 25 / 27");
    fireEvent.click(row);
    expect(props.onOpen).toHaveBeenCalledWith("second-change", false);

    const archived = screen.getByTestId("comparison-row-2026-09-13-first-change");
    fireEvent.click(archived);
    expect(props.onOpen).toHaveBeenCalledWith("2026-09-13-first-change", true);
  });

  it("presses the chosen period and reports another being chosen", () => {
    const { props } = view();

    const periods = within(screen.getByRole("group", { name: "Period" }));
    expect(periods.getByRole("button", { name: "5 days" })).toHaveAttribute("aria-pressed", "true");
    expect(periods.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(periods.getByRole("button", { name: "All" }));
    expect(props.onPeriod).toHaveBeenCalledWith("all");
  });

  it("says how many of how many match, only while something is typed", () => {
    const { unmount, props } = view();
    expect(screen.queryByTestId("comparison-filter-count")).toBeNull();
    fireEvent.change(screen.getByTestId("comparison-filter"), { target: { value: "s" } });
    expect(props.onFilter).toHaveBeenCalled();
    unmount();

    view({}, "second");
    expect(screen.getByTestId("comparison-filter-count")).toHaveTextContent("1 of 2 match");
  });

  it("says which colour means what, and what the line and the shading are", () => {
    view();

    const legend = within(screen.getByTestId("comparison-legend"));
    expect(legend.getByText("Archived")).toBeInTheDocument();
    expect(legend.getByText("Active")).toBeInTheDocument();
    expect(screen.getByTestId("comparison-footnote")).toHaveTextContent(
      "The dashed line is now. Sat and Sun are shaded. Click a row to open that change's own timeline.",
    );
  });

  it("keeps a row with no bar for a change carrying no dates", () => {
    const window = comparisonWindow("5-days", SPANS, NOW);
    const undated = [span("never-committed", null, null, { done: 0, total: 3 })];
    render(
      <ChangeComparisonView
        window={window}
        rows={comparisonRows(undated, window, NOW)}
        total={1}
        period="5-days"
        onPeriod={vi.fn()}
        filter=""
        onFilter={vi.fn()}
        now={NOW}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("comparison-bar-never-committed")).toBeNull();
    expect(screen.getByText("no dates")).toBeInTheDocument();
    expect(screen.getByTestId("comparison-row-never-committed")).toHaveAccessibleName(/no proposed date/);
  });

  it("says the charts are being read, then draws them", () => {
    const { unmount } = view({ readingCharts: "Reading 2 changes' history from git…" });
    expect(screen.getByTestId("comparison-charts-reading")).toHaveTextContent("Reading 2 changes' history from git…");
    expect(screen.queryByTestId("change-charts")).toBeNull();
    unmount();

    view({ timelines: [timeline] });
    expect(screen.getByTestId("change-charts")).toBeInTheDocument();
    expect(screen.queryByTestId("comparison-charts-reading")).toBeNull();
  });

  it("says the charts could not be read, and keeps the grid", () => {
    view({ chartsError: "The charts could not be read: git failed.", readingCharts: "Reading…" });

    expect(screen.getByTestId("comparison-charts-error")).toHaveTextContent("The charts could not be read: git failed.");
    expect(screen.queryByTestId("comparison-charts-reading")).toBeNull();
    expect(screen.getByTestId("comparison-row-second-change")).toBeInTheDocument();
  });

  it("says which empty it is when nothing is drawn", () => {
    const window = comparisonWindow("5-days", [], NOW);
    const { unmount } = render(
      <ChangeComparisonView
        window={window}
        rows={[]}
        total={0}
        period="5-days"
        onPeriod={vi.fn()}
        filter=""
        onFilter={vi.fn()}
        now={NOW}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByTestId("comparison-empty")).toHaveTextContent("No change of this workspace falls in these days.");
    unmount();

    view({}, "nothing-matches-this");
    expect(screen.getByTestId("comparison-empty")).toHaveTextContent("No change matches that name.");
  });
});
