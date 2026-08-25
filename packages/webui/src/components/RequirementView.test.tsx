import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequirementView, extractCapabilityMentions } from "./RequirementView.js";

describe("extractCapabilityMentions", () => {
  it("finds known spec ids quoted as code spans", () => {
    const text = "Data comes from `execution-core`, not from `shared-ui`.";
    expect(extractCapabilityMentions(text, ["execution-core", "shared-ui", "vscode-extension"])).toEqual([
      "execution-core",
      "shared-ui",
    ]);
  });

  it("ignores code spans that are not known spec ids", () => {
    const text = "The `implement` command invokes `execution-core`.";
    expect(extractCapabilityMentions(text, ["execution-core"])).toEqual(["execution-core"]);
  });

  it("returns an empty array when there are no mentions", () => {
    expect(extractCapabilityMentions("no code spans here", ["execution-core"])).toEqual([]);
  });
});

describe("RequirementView", () => {
  it("renders the requirement text with inline markdown", () => {
    render(<RequirementView requirement={{ text: "The system **SHALL** do X.", scenarios: [] }} />);
    expect(screen.getByTestId("requirement-view").querySelector("strong")).toHaveTextContent("SHALL");
  });

  it("renders scenarios as preformatted blocks", () => {
    render(
      <RequirementView
        requirement={{ text: "X", scenarios: [{ rawText: "- **WHEN** a\n- **THEN** b" }] }}
      />,
    );
    expect(screen.getByTestId("requirement-scenarios")).toHaveTextContent("WHEN");
  });

  it("renders navigable links for mentioned known specs", () => {
    const onNavigateToSpec = vi.fn();
    render(
      <RequirementView
        requirement={{ text: "Uses the protocol from `execution-core`.", scenarios: [] }}
        knownSpecIds={["execution-core"]}
        onNavigateToSpec={onNavigateToSpec}
      />,
    );
    fireEvent.click(screen.getByTestId("nav-execution-core"));
    expect(onNavigateToSpec).toHaveBeenCalledWith("execution-core");
  });

  it("renders no links section when there are no mentions", () => {
    render(<RequirementView requirement={{ text: "Plain text.", scenarios: [] }} />);
    expect(screen.queryByTestId("requirement-links")).not.toBeInTheDocument();
  });
});
