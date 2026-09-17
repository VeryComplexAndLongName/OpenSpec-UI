import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CHANGE_PICKER_SHOWN, ChangePicker, matchingChanges, type ChangePickerOption } from "./ChangePicker.js";

// the-timeline-finds-a-change 1.3: a change is found by typing part of its
// name, and chosen with the keyboard or the mouse.

const OPTIONS: ChangePickerOption[] = [
  { value: "active:a-screen-says-what-it-is-doing", name: "a-screen-says-what-it-is-doing", archived: false },
  { value: "archived:2026-09-14-a-run-says-which-task-it-is-on", name: "a-run-says-which-task-it-is-on", archived: true, keywords: "2026-09-14-a-run-says-which-task-it-is-on" },
  { value: "archived:2026-09-10-the-owl-marks-the-app", name: "the-owl-marks-the-app", archived: true, keywords: "2026-09-10-the-owl-marks-the-app" },
];

function draw(value = "", onChange = vi.fn()) {
  render(<ChangePicker label="Change to show a timeline for" placeholder="Find a change by name" options={OPTIONS} value={value} onChange={onChange} testId="picker" />);
  return { onChange, field: screen.getByTestId("picker") };
}

function shownValues(): string[] {
  return screen.queryAllByRole("option").map((option) => option.getAttribute("data-testid")?.replace("change-picker-option-", "") ?? "");
}

describe("matchingChanges", () => {
  it("keeps the options every word of the query appears in, whatever the case, in their order", () => {
    expect(matchingChanges(OPTIONS, "").map((option) => option.name)).toHaveLength(3);
    expect(matchingChanges(OPTIONS, "SAYS").map((option) => option.name)).toEqual(["a-screen-says-what-it-is-doing", "a-run-says-which-task-it-is-on"]);
    expect(matchingChanges(OPTIONS, "says task").map((option) => option.name)).toEqual(["a-run-says-which-task-it-is-on"]);
    // The archive folder's date is searchable, and so is the word "archived".
    expect(matchingChanges(OPTIONS, "2026-09-10").map((option) => option.name)).toEqual(["the-owl-marks-the-app"]);
    expect(matchingChanges(OPTIONS, "archived owl").map((option) => option.name)).toEqual(["the-owl-marks-the-app"]);
    expect(matchingChanges(OPTIONS, "nothing-like-it")).toEqual([]);
  });
});

describe("ChangePicker", () => {
  it("shows the chosen change, and lists every change once the field takes focus", () => {
    const { field } = draw("archived:2026-09-14-a-run-says-which-task-it-is-on");
    expect(field).toHaveValue("a-run-says-which-task-it-is-on · archived");
    expect(field).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.focus(field);
    expect(field).toHaveAttribute("aria-expanded", "true");
    expect(shownValues()).toHaveLength(3);
    expect(screen.getByTestId("change-picker-count")).toHaveTextContent("3 of 3 changes");
  });

  it("narrows the list as a person types, and says when nothing matches", () => {
    const { field } = draw();
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "owl" } });
    expect(shownValues()).toEqual(["archived:2026-09-10-the-owl-marks-the-app"]);
    expect(screen.getByTestId("change-picker-count")).toHaveTextContent("1 of 3 changes");

    fireEvent.change(field, { target: { value: "no such change" } });
    expect(shownValues()).toEqual([]);
    expect(screen.getByTestId("change-picker-count")).toHaveTextContent("No change matches.");
  });

  it("walks the matches with the arrow keys and chooses one with Enter", () => {
    const { field, onChange } = draw();
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "says" } });
    expect(field).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0]?.id);

    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    expect(field).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[1]?.id);
    fireEvent.keyDown(field, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("archived:2026-09-14-a-run-says-which-task-it-is-on");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("chooses a change with the mouse, and Escape closes the list without choosing", () => {
    const { field, onChange } = draw();
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "ArrowDown" });
    fireEvent.mouseDown(screen.getByTestId("change-picker-option-active:a-screen-says-what-it-is-doing"));
    expect(onChange).toHaveBeenCalledWith("active:a-screen-says-what-it-is-doing");
  });

  it("draws at most its limit of matches, and counts the rest", () => {
    const many = Array.from({ length: CHANGE_PICKER_SHOWN + 20 }, (_, index) => ({
      value: `archived:2026-01-01-change-${index}`,
      name: `change-${index}`,
      archived: true,
    }));
    render(<ChangePicker label="Change" placeholder="Find" options={many} value="" onChange={vi.fn()} testId="picker" />);
    fireEvent.focus(screen.getByTestId("picker"));
    expect(screen.getAllByRole("option")).toHaveLength(CHANGE_PICKER_SHOWN);
    expect(screen.getByTestId("change-picker-count")).toHaveTextContent(`${CHANGE_PICKER_SHOWN} of ${CHANGE_PICKER_SHOWN + 20} matches shown; type more of the name.`);
  });
});
