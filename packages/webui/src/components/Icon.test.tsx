import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon.js";

describe("Icon", () => {
  it("adds nothing to a button's accessible name", () => {
    render(
      <button type="button">
        <Icon meaning="run" />
        Run
      </button>,
    );
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
  });

  it("renders as a bare span carrying only the glyph class and aria-hidden", () => {
    render(<Icon meaning="change" />);
    const icon = document.querySelector(".openspec-icon-git-compare");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon?.textContent).toBe("");
  });
});
