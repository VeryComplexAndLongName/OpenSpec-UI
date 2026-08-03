import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangeRelations, findRelatedChangeNames } from "./ChangeRelations.js";

describe("findRelatedChangeNames", () => {
  it("returns only known names actually mentioned in the text", () => {
    const text = "Depends on execution-core for the protocol. Unrelated to standalone-app.";
    const result = findRelatedChangeNames(text, ["execution-core", "standalone-app", "vscode-extension"]);
    expect(result).toEqual(["execution-core", "standalone-app"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(findRelatedChangeNames("no mentions here", ["execution-core"])).toEqual([]);
  });
});

describe("ChangeRelations", () => {
  it("renders a clickable entry per related change", () => {
    render(
      <ChangeRelations
        proposalText="Зависит от execution-core (протокол команд/событий)."
        knownChangeNames={["execution-core", "standalone-app"]}
      />,
    );
    expect(screen.getByTestId("change-relations").querySelectorAll("li")).toHaveLength(1);
    expect(screen.getByTestId("relation-execution-core")).toBeInTheDocument();
  });

  it("calls onNavigate with the related change name", () => {
    const onNavigate = vi.fn();
    render(
      <ChangeRelations
        proposalText="Зависит от execution-core."
        knownChangeNames={["execution-core"]}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByTestId("relation-execution-core"));
    expect(onNavigate).toHaveBeenCalledWith("execution-core");
  });

  it("shows an empty-state message when nothing is related", () => {
    render(<ChangeRelations proposalText="Standalone text." knownChangeNames={["execution-core"]} />);
    expect(screen.queryByTestId("change-relations")).not.toBeInTheDocument();
    expect(screen.getByText("No related changes mentioned.")).toBeInTheDocument();
  });
});
