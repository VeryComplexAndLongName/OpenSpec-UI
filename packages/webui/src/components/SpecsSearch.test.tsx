import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpecsSearch, searchSpecs } from "./SpecsSearch.js";
import type { SpecSummary } from "./SpecsTree.js";

const specs: SpecSummary[] = [
  {
    id: "execution-core",
    requirements: [
      { text: "The system SHALL provide a unified command protocol.", scenarios: [] },
      { text: "Every agent run is audited.", scenarios: [] },
    ],
  },
  { id: "shared-ui", requirements: [{ text: "Components do not depend on the transport.", scenarios: [] }] },
];

describe("searchSpecs", () => {
  it("returns nothing for an empty query", () => {
    expect(searchSpecs(specs, "")).toEqual([]);
    expect(searchSpecs(specs, "   ")).toEqual([]);
  });

  it("matches by spec id", () => {
    const results = searchSpecs(specs, "shared");
    expect(results).toHaveLength(1);
    expect(results[0]?.specId).toBe("shared-ui");
  });

  it("matches by requirement text, case-insensitively", () => {
    const results = searchSpecs(specs, "AUDITED".toLowerCase());
    expect(results).toHaveLength(1);
    expect(results[0]?.specId).toBe("execution-core");
    expect(results[0]?.requirementIndex).toBe(1);
  });
});

describe("SpecsSearch", () => {
  it("renders matching results as the user types", () => {
    render(<SpecsSearch specs={specs} />);
    fireEvent.change(screen.getByLabelText("Search specs"), { target: { value: "protocol" } });
    expect(screen.getByTestId("specs-search-results").querySelectorAll("li")).toHaveLength(1);
  });

  it("calls onSelect with specId and requirementIndex", () => {
    const onSelect = vi.fn();
    render(<SpecsSearch specs={specs} onSelect={onSelect} />);
    fireEvent.change(screen.getByLabelText("Search specs"), { target: { value: "transport" } });
    fireEvent.click(screen.getByTestId("result-shared-ui-0"));
    expect(onSelect).toHaveBeenCalledWith("shared-ui", 0);
  });

  it("shows nothing before typing anything", () => {
    render(<SpecsSearch specs={specs} />);
    expect(screen.getByTestId("specs-search-results").querySelectorAll("li")).toHaveLength(0);
  });
});
