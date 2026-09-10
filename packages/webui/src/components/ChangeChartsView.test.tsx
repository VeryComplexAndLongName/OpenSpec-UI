import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangeChartsView } from "./ChangeChartsView.js";
import type { ChangeTimeline } from "../change-timeline-client.js";

// charts-over-what-happened. The arithmetic is tested over in core's
// own change-charts.test.ts, where it now lives; what these assert is
// that the chart shows what it rests on and says so where there is
// nothing to draw.

function archivedChange(name: string, proposed: string, archivedAt: string): ChangeTimeline {
  return {
    changeName: name,
    archived: true,
    dates: {
      proposed: { date: proposed, day: proposed.slice(0, 10), source: "git-commit" },
      firstWorked: { date: null, day: null, source: "none" },
      lastWorked: { date: null, day: null, source: "none" },
      archived: { date: archivedAt, day: archivedAt.slice(0, 10), source: "git-commit" },
    },
    createdDate: proposed,
    archivedDate: archivedAt.slice(0, 10),
    proposal: "",
    design: "",
    specs: [],
    tasks: [],
  };
}

describe("ChangeChartsView", () => {
  it("draws a bar per day and the same numbers as a table", () => {
    render(<ChangeChartsView timelines={[
      archivedChange("a", "2026-09-01T09:00:00.000Z", "2026-09-01T17:00:00.000Z"),
      archivedChange("b", "2026-09-01T09:00:00.000Z", "2026-09-03T17:00:00.000Z"),
    ]} />);

    const chart = screen.getByTestId("chart-archived-per-day");
    // Three days: two with a change and the quiet one between them.
    expect(chart.querySelectorAll("rect")).toHaveLength(3);
    const table = screen.getByTestId("chart-archived-per-day-table");
    expect(table.textContent).toContain("2026-09-02");
  });

  it("says what it rests on, including where the dates came from", () => {
    render(<ChangeChartsView timelines={[
      archivedChange("a", "2026-09-01T09:00:00.000Z", "2026-09-01T17:00:00.000Z"),
    ]} />);

    expect(screen.getByTestId("chart-archived-per-day-basis").textContent)
      .toContain("dated from a commit");
  });

  it("counts a change it cannot date rather than plotting it somewhere", () => {
    const undated = archivedChange("undated", "2026-09-01T09:00:00.000Z", "2026-09-02T09:00:00.000Z");
    undated.dates.archived = { date: null, day: null, source: "none" };

    render(<ChangeChartsView timelines={[
      archivedChange("a", "2026-09-01T09:00:00.000Z", "2026-09-01T17:00:00.000Z"),
      undated,
    ]} />);

    expect(screen.getByTestId("chart-archived-per-day-basis").textContent)
      .toContain("1 left out for having no date");
  });

  it("renders a sentence and no axes when there is nothing to draw", () => {
    // An empty frame looks like a chart that found nothing, which is a
    // different claim from having nothing to look at.
    render(<ChangeChartsView timelines={[]} />);

    expect(screen.getByTestId("chart-archived-per-day-empty")).toBeTruthy();
    expect(screen.queryByTestId("chart-archived-per-day")).toBeNull();
  });

  it("says why the work span is not charted, about the changes it was given", () => {
    // The sentence was a constant claiming "measured over this
    // repository, 135 of 185 changes…" in every workspace. It counts
    // what it was handed now: one change here, with no finished task,
    // so there is nothing to measure a span between.
    render(<ChangeChartsView timelines={[
      archivedChange("a", "2026-09-01T09:00:00.000Z", "2026-09-01T17:00:00.000Z"),
    ]} />);

    // An absence that is not explained reads as an omission.
    const note = screen.getByTestId("chart-work-duration-note").textContent ?? "";
    expect(note).toContain("How long the work itself took is not charted");
    expect(note).not.toContain("135 of 185");
    expect(note).not.toContain("this repository");
  });
});
