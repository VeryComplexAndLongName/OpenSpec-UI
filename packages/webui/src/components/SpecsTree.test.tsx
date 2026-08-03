import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpecsTree, type SpecSummary } from "./SpecsTree.js";

const specs: SpecSummary[] = [
  {
    id: "execution-core",
    requirements: [
      { text: "Система SHALL предоставлять единый протокол.", scenarios: [] },
      { text: "Система SHALL аудировать каждый запуск.", scenarios: [] },
    ],
  },
  { id: "shared-ui", requirements: [{ text: "Компоненты не зависят от транспорта.", scenarios: [] }] },
];

describe("SpecsTree", () => {
  it("renders each spec collapsed by default, with its requirement count", () => {
    render(<SpecsTree specs={specs} />);
    expect(screen.getByTestId("spec-toggle-execution-core")).toHaveTextContent("execution-core (2)");
    expect(screen.queryByTestId("requirement-execution-core-0")).not.toBeInTheDocument();
  });

  it("expands a spec on click to reveal its requirements", () => {
    render(<SpecsTree specs={specs} />);
    fireEvent.click(screen.getByTestId("spec-toggle-execution-core"));
    expect(screen.getByTestId("requirement-execution-core-0")).toBeInTheDocument();
    expect(screen.getByTestId("requirement-execution-core-1")).toBeInTheDocument();
    expect(screen.queryByTestId("requirement-shared-ui-0")).not.toBeInTheDocument();
  });

  it("collapses again on a second click", () => {
    render(<SpecsTree specs={specs} />);
    const toggle = screen.getByTestId("spec-toggle-execution-core");
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.queryByTestId("requirement-execution-core-0")).not.toBeInTheDocument();
  });

  it("calls onSelectRequirement with the spec id and requirement index", () => {
    const onSelectRequirement = vi.fn();
    render(<SpecsTree specs={specs} onSelectRequirement={onSelectRequirement} />);
    fireEvent.click(screen.getByTestId("spec-toggle-execution-core"));
    fireEvent.click(screen.getByTestId("requirement-execution-core-1"));
    expect(onSelectRequirement).toHaveBeenCalledWith("execution-core", 1);
  });
});
