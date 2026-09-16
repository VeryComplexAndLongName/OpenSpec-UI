import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DescribedChangeState } from "@openspec-ui/core/browser";
import { ChangesList } from "./ChangesList.js";
import type { ChangeSummary } from "../types.js";

// a-change-says-where-it-stands 6.2. The words are core's; these assert the
// list shows them, that the colour only agrees with a word that is always
// written, and that what could not be read is said.

const changes: ChangeSummary[] = [
  { name: "alpha", state: "in-progress", completedTasks: 1, totalTasks: 4 },
  { name: "beta", state: "draft", completedTasks: 0, totalTasks: 2 },
];

const states = new Map<string, DescribedChangeState>([
  ["alpha", { key: "archived-on-main", word: "Archived on main", colour: "settled", badge: "A", lines: [{ text: "Ready", source: "this checkout" }] }],
  ["beta", { key: "ready", word: "Ready", colour: "none", lines: [{ text: "Only here", source: "every source read" }] }],
]);

describe("ChangesList — where each change stands", () => {
  it("writes each change's word and lines, with a colour that agrees and a word that is there without one", () => {
    render(<ChangesList changes={changes} states={states} />);

    const alpha = screen.getByTestId("change-alpha-standing");
    expect(alpha).toHaveTextContent("Archived on main");
    expect(alpha.className).toContain("openspec-change-standing--settled");
    expect(screen.getByTestId("change-alpha-lines")).toHaveTextContent("Ready");
    expect(screen.getByTestId("change-beta-standing")).toHaveTextContent("Ready");
    expect(screen.getByTestId("change-beta-standing").className).toContain("openspec-change-standing--none");
  });

  // A word longer than the state column is cut in the badge; its title keeps
  // it whole.
  it("keeps a standing's whole word in the badge's title", () => {
    render(<ChangesList changes={changes} states={states} />);

    expect(screen.getByTestId("change-alpha-standing")).toHaveAttribute("title", "Archived on main");
  });

  // the-summary-looks-like-the-mockup 2.3: a row with a standing keeps its
  // progress, and the footnote it is given sits at the panel's foot.
  it("keeps each row's progress beside its word, and prints the footnote at the foot", () => {
    render(<ChangesList changes={changes} states={states} footnote="Workspace read from here." />);

    expect(screen.getByTestId("change-alpha")).toHaveTextContent("1 / 4");
    expect(screen.getByRole("img", { name: "25% done" })).toBeInTheDocument();
    expect(screen.getByTestId("summary-changes").querySelector(".openspec-panel-foot")).toHaveTextContent("Workspace read from here.");
  });

  it("says which main was read, when refs were last fetched, and that the fetch failed", () => {
    const sources = "Main read from origin/main. Refs last fetched 2026-09-14 00:30 UTC. The fetch at 2026-09-14 00:45 UTC failed: could not resolve host.";
    render(<ChangesList changes={changes} states={states} sources={sources} />);

    expect(screen.getByTestId("changes-sources")).toHaveTextContent("failed: could not resolve host");
    expect(screen.getByTestId("change-alpha-standing")).toHaveTextContent("Archived on main");
  });

  it("offers Refresh, says a refresh is under way, and allows no second press meanwhile", () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<ChangesList changes={changes} states={states} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByTestId("changes-refresh"));
    rerender(<ChangesList changes={changes} states={states} onRefresh={onRefresh} refreshing />);

    expect(screen.getByTestId("changes-refresh")).toHaveTextContent("Refreshing…");
    expect(screen.getByTestId("changes-refresh")).toBeDisabled();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
