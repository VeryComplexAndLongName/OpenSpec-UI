import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle.js";

// a-screen-says-what-it-is-doing 4.3
describe("ThemeToggle", () => {
  it("keeps the name 'Dark theme' in both states, and says the state as a switch", () => {
    const { rerender } = render(<ThemeToggle theme="light" onToggle={vi.fn()} />);

    const light = screen.getByRole("switch", { name: "Dark theme" });
    expect(light).toHaveAttribute("aria-checked", "false");
    // No visible words: the owner read "Dark theme" beside the switch as
    // meaningless, and the glyph on the knob says it.
    expect(light.textContent?.trim()).toBe("");

    rerender(<ThemeToggle theme="dark" onToggle={vi.fn()} />);

    const dark = screen.getByRole("switch", { name: "Dark theme" });
    expect(dark).toBe(light);
    expect(dark).toHaveAttribute("aria-checked", "true");
  });

  it("shows a sun when light and a moon when dark, hidden from assistive technology", () => {
    const { rerender } = render(<ThemeToggle theme="light" onToggle={vi.fn()} />);
    const glyph = () => screen.getByTestId("theme-toggle").querySelector("svg");

    expect(glyph()).toHaveAttribute("data-glyph", "sun");
    expect(glyph()).toHaveAttribute("aria-hidden", "true");

    rerender(<ThemeToggle theme="dark" onToggle={vi.fn()} />);

    expect(glyph()).toHaveAttribute("data-glyph", "moon");
  });

  it("toggles when pressed", () => {
    const onToggle = vi.fn();
    render(<ThemeToggle theme="light" onToggle={onToggle} />);

    screen.getByRole("switch", { name: "Dark theme" }).click();

    expect(onToggle).toHaveBeenCalledOnce();
  });
});
