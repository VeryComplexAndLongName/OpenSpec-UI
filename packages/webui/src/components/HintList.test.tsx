import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Hint } from "@openspec-ui/core/browser";
import { HintList } from "./HintList.js";

// Two properties, and neither is about layout: a suggestion is shown
// with the fact it came from, and nothing is shown when there is nothing
// to suggest. An empty region with a heading reads as a broken surface
// rather than as one with no news.
// See a-hint-says-what-can-run-together.

const HINT: Hint = {
  id: "can-run-together:alpha+beta",
  kind: "can-run-together",
  subject: "alpha and beta can run at the same time",
  because: "Each is ready, and no two of them collide over anything.",
  commands: ["openspec-ui-cli run alpha --cwd <alpha's worktree>"],
};

describe("HintList", () => {
  it("shows a suggestion with its reason and its commands", () => {
    render(<HintList hints={[HINT]} />);
    expect(screen.getByText("alpha and beta can run at the same time")).toBeTruthy();
    expect(screen.getByText(HINT.because)).toBeTruthy();
    expect(screen.getByText(HINT.commands[0] as string)).toBeTruthy();
  });

  it("shows nothing at all when there is nothing to suggest", () => {
    const { container } = render(<HintList hints={[]} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("hint-list")).toBeNull();
  });

  it("shows nothing when the workspace computed no suggestions", () => {
    // `undefined` rather than `[]`: the payload carries no key at all
    // when suggestions are off, and the component must not treat the
    // absence as an error or a placeholder.
    const { container } = render(<HintList hints={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("offers no control that runs a command", () => {
    render(<HintList hints={[HINT]} />);
    // This capability writes nothing and starts nothing. A button here
    // would make it the kind of thing that does.
    expect(screen.queryAllByRole("button")).toEqual([]);
  });
});
