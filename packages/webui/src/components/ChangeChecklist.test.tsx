import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ChangeChecklist, archivedOn, changesInRange, type CheckableChange } from "./ChangeChecklist.js";

// the-sprint-picks-its-changes.

const CHANGES: CheckableChange[] = [
  { value: "active:still-going", name: "still-going", archived: false },
  { value: "archived:2026-09-21-latest", name: "2026-09-21-latest", archived: true },
  { value: "archived:2026-09-15-last-week", name: "2026-09-15-last-week", archived: true },
  { value: "archived:2026-08-01-long-ago", name: "2026-08-01-long-ago", archived: true },
];

function Harness({ start = "", end = "" }: { start?: string; end?: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  return <ChangeChecklist label="Changes in this sprint" changes={CHANGES} selected={selected} onChange={setSelected} rangeStart={start} rangeEnd={end} />;
}

describe("changesInRange", () => {
  it("takes what was archived within the range, and what is under way", () => {
    expect(changesInRange(CHANGES, "2026-09-14", "2026-09-21")).toEqual([
      "active:still-going",
      "archived:2026-09-21-latest",
      "archived:2026-09-15-last-week",
    ]);
    expect(archivedOn("no-date-here")).toBeUndefined();
  });
});

describe("ChangeChecklist", () => {
  it("shows every change as a row to tick, and counts what is chosen", () => {
    render(<Harness />);
    const list = screen.getByRole("group", { name: "Changes in this sprint" });

    expect(within(list).getAllByRole("checkbox")).toHaveLength(4);
    fireEvent.click(within(list).getByRole("checkbox", { name: /2026-09-15-last-week/u }));
    expect(screen.getByTestId("change-checklist-count")).toHaveTextContent("1 of 4 chosen");
  });

  it("takes a range's worth at once, all, and none", () => {
    render(<Harness start="2026-09-14" end="2026-09-21" />);

    fireEvent.click(screen.getByTestId("change-checklist-in-range"));
    expect(screen.getByTestId("change-checklist-count")).toHaveTextContent("3 of 4 chosen");
    expect(screen.getByRole("checkbox", { name: /2026-08-01-long-ago/u })).not.toBeChecked();
    fireEvent.click(screen.getByTestId("change-checklist-all"));
    expect(screen.getByTestId("change-checklist-count")).toHaveTextContent("4 of 4 chosen");
    fireEvent.click(screen.getByTestId("change-checklist-none"));
    expect(screen.getByTestId("change-checklist-count")).toHaveTextContent("0 of 4 chosen");
  });

  it("narrows the rows by what is typed, and keeps what was ticked", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /still-going/u }));

    fireEvent.change(screen.getByRole("searchbox", { name: "Find in Changes in this sprint" }), { target: { value: "last week" } });

    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByTestId("change-checklist-count")).toHaveTextContent("1 of 4 chosen");
  });

  it("cannot take a range before a range is given", () => {
    render(<Harness />);

    expect(screen.getByTestId("change-checklist-in-range")).toBeDisabled();
  });
});
