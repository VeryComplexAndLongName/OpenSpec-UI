import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangeDiff } from "./ChangeDiff.js";

describe("ChangeDiff", () => {
  it("renders added and removed lines with markers", () => {
    render(
      <ChangeDiff
        before={"- [ ] task one\n- [ ] task two\n"}
        after={"- [x] task one\n- [ ] task two\n"}
      />,
    );

    const container = screen.getByTestId("change-diff");
    const removed = container.querySelector(".openspec-diff-line--removed");
    const added = container.querySelector(".openspec-diff-line--added");
    const unchanged = container.querySelector(".openspec-diff-line--unchanged");
    expect(removed).toHaveTextContent("- - [ ] task one");
    expect(added).toHaveTextContent("+ - [x] task one");
    expect(unchanged).toHaveTextContent("- [ ] task two");
  });

  it("renders custom before/after labels", () => {
    render(<ChangeDiff before="a" after="b" beforeLabel="v1" afterLabel="v2" />);
    const container = screen.getByTestId("change-diff");
    expect(container).toHaveTextContent("v1");
    expect(container).toHaveTextContent("v2");
  });

  it("renders no diff lines when before and after are identical", () => {
    render(<ChangeDiff before="same\n" after="same\n" />);
    const container = screen.getByTestId("change-diff");
    expect(container.querySelectorAll(".openspec-diff-line--added")).toHaveLength(0);
    expect(container.querySelectorAll(".openspec-diff-line--removed")).toHaveLength(0);
  });
});
