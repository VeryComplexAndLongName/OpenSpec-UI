import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelStatus } from "./PanelStatus.js";

// a-screen-says-what-it-is-doing 3.4
describe("PanelStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when nothing is being read", () => {
    const { container } = render(<PanelStatus reading={null} testId="status" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("puts the sentence in a status message, with the bar and spinner hidden from assistive technology", () => {
    render(<PanelStatus reading="Reading the diff of alpha from git…" testId="status" />);

    expect(screen.getByRole("status")).toHaveTextContent("Reading the diff of alpha from git…");
    const panel = screen.getByTestId("status");
    expect(panel.querySelector(".openspec-panel-status-bar")).toHaveAttribute("aria-hidden", "true");
    expect(panel.querySelector(".openspec-panel-status-spinner")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the elapsed seconds only after three, and outside the status message", () => {
    render(<PanelStatus reading="Reading persisted runs…" testId="status" />);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.queryByTestId("status-elapsed")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByTestId("status-elapsed")).toHaveTextContent("5 s");
    expect(screen.getByTestId("status-elapsed")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/^Reading persisted runs…$/u);
  });

  it("goes when the reading settles, and starts counting again for the next one", () => {
    const { rerender } = render(<PanelStatus reading="Reading persisted runs…" testId="status" />);
    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    rerender(<PanelStatus reading={null} testId="status" />);
    expect(screen.queryByTestId("status")).not.toBeInTheDocument();

    rerender(<PanelStatus reading="Reading persisted runs…" testId="status" />);
    expect(screen.queryByTestId("status-elapsed")).not.toBeInTheDocument();
  });
});
