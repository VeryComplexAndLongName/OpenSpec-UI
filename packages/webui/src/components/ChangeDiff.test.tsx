import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangeDiff } from "./ChangeDiff.js";

const UNIFIED = [
  "diff --git a/openspec/changes/alpha/tasks.md b/openspec/changes/alpha/tasks.md",
  "--- a/openspec/changes/alpha/tasks.md",
  "+++ b/openspec/changes/alpha/tasks.md",
  "@@ -1,2 +1,2 @@",
  "-- [ ] task one",
  "+- [x] task one",
  " - [ ] task two",
  "",
].join("\n");

function linesOf(kind: string): Element[] {
  return [...screen.getByTestId("change-diff").querySelectorAll(`.openspec-diff-line--${kind}`)];
}

// a-screen-says-what-it-is-doing 2.3
describe("ChangeDiff", () => {
  it("colours an added line, a removed line and a context line by their first character", () => {
    render(<ChangeDiff unified={UNIFIED} />);

    expect(linesOf("removed").map((line) => line.textContent)).toEqual(["-- [ ] task one"]);
    expect(linesOf("added").map((line) => line.textContent)).toEqual(["+- [x] task one"]);
    expect(linesOf("unchanged").map((line) => line.textContent)).toEqual([" - [ ] task two"]);
  });

  it("does not count a file's own --- and +++ header lines as a removal or an addition", () => {
    render(<ChangeDiff unified={UNIFIED} />);

    expect(linesOf("meta")).toHaveLength(3);
    expect(linesOf("hunk").map((line) => line.textContent)).toEqual(["@@ -1,2 +1,2 @@"]);
  });

  it("renders no line for an empty diff", () => {
    render(<ChangeDiff unified="" />);

    expect(screen.getByTestId("change-diff").querySelectorAll(".openspec-diff-line")).toHaveLength(0);
  });
});
