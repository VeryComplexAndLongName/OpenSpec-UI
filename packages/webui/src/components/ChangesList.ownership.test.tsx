import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChangeOwnership } from "@openspec-ui/core/browser";
import { ChangesList } from "./ChangesList.js";
import type { ChangeSummary } from "../types.js";

// changes-shows-one-change-and-who-owns-it 6.2. The words are core's;
// these assert the list shows them, and that a change worked elsewhere is
// drawn apart from this directory's own.

const changes: ChangeSummary[] = [
  { name: "alpha", state: "in-progress", completedTasks: 1, totalTasks: 4 },
  { name: "beta", state: "draft", completedTasks: 0, totalTasks: 2 },
  { name: "gamma", state: "draft", completedTasks: 0, totalTasks: 1 },
];

const ownerships = new Map<string, ChangeOwnership>([
  ["alpha", { kind: "here" }],
  ["beta", { kind: "elsewhere", label: "beta-worktree", path: "/wt/beta", person: "DW" }],
  ["gamma", { kind: "nobody" }],
]);

describe("ChangesList, whose each change is", () => {
  it("says where a change is worked, and by whom", () => {
    render(<ChangesList changes={changes} ownerships={ownerships} />);

    expect(screen.getByTestId("change-beta-worked")).toHaveTextContent("worked in beta-worktree, by DW");
  });

  it("says nothing extra about this working directory's own change", () => {
    render(<ChangesList changes={changes} ownerships={ownerships} />);

    expect(screen.queryByTestId("change-alpha-worked")).toBeNull();
  });

  it("says nothing about a change nobody has taken up", () => {
    render(<ChangesList changes={changes} ownerships={ownerships} />);

    // The ordinary case, and the one a caption on every row would drown.
    expect(screen.queryByTestId("change-gamma-worked")).toBeNull();
  });

  it("draws another directory's change apart from one this directory may act on", () => {
    render(<ChangesList changes={changes} ownerships={ownerships} />);

    expect(screen.getByTestId("change-beta").className).toContain("openspec-change-row--elsewhere");
    expect(screen.getByTestId("change-alpha").className).not.toContain("openspec-change-row--elsewhere");
    expect(screen.getByTestId("change-gamma").className).not.toContain("openspec-change-row--elsewhere");
  });

  it("draws every row as before where no survey has been read", () => {
    render(<ChangesList changes={changes} />);

    expect(screen.queryByTestId("change-beta-worked")).toBeNull();
    expect(screen.getByTestId("change-beta").className).not.toContain("openspec-change-row--elsewhere");
  });
});
