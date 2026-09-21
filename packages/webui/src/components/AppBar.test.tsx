import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppBar } from "./AppBar.js";

// the-shell-wears-the-site-frame 2.8
describe("AppBar", () => {
  it("names the product as text, not as a heading, and carries the workspace and the theme switch", () => {
    render(<AppBar workspacePath={"C:\\Prog\\OpenSpec-UI"} theme="light" onToggleTheme={vi.fn()} />);

    const bar = screen.getByTestId("app-bar");
    expect(bar).toHaveTextContent("OpenSpec Workbench");
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByTestId("app-bar-workspace")).toHaveTextContent("C:\\Prog\\OpenSpec-UI");
    expect(screen.getByRole("switch", { name: "Dark theme" })).toBeInTheDocument();
  });

  it("shows no path while the workspace is not yet known", () => {
    render(<AppBar workspacePath="" theme="dark" onToggleTheme={vi.fn()} />);

    expect(screen.queryByTestId("app-bar-workspace")).toBeNull();
  });
});
