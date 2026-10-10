import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangeReadiness } from "@openspec-ui/core/browser";
import { PipelineView } from "./PipelineView.js";
import { shownCardOf } from "../show-card.js";

// the-side-panel-is-the-workspace: a change chosen in the editor's
// Workspace navigator shows its card - scrolled to, marked for a moment and
// focused - whether the card is drawn yet or not.

const scrollIntoView = Element.prototype.scrollIntoView;

afterEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.restoreAllMocks();
});

function change(changeName: string): ChangeReadiness {
  return { changeName, blockers: [], run: { state: "ready" }, capabilities: [], canJoin: [], blockedFrom: [] };
}

describe("PipelineView - a card the host asks to show", () => {
  it("scrolls to the card once it is drawn, marks it and gives it the focus", async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const load = vi.fn(async () => ({ changes: [change("alpha"), change("beta")] }));

    render(<PipelineView isActive load={load} focus={{ changeName: "beta", at: 1 }} />);

    const card = await screen.findByTestId("pipeline-node-beta");
    await waitFor(() => expect(card).toHaveAttribute("data-focused", "true"));
    expect(scrolled).toHaveBeenCalledWith({ block: "center", inline: "center" });
    expect(card.contains(document.activeElement)).toBe(true);
    expect(screen.getByTestId("pipeline-node-alpha")).not.toHaveAttribute("data-focused");
  });

  it("marks nothing for a change that has no card", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const load = vi.fn(async () => ({ changes: [change("alpha")] }));

    render(<PipelineView isActive load={load} focus={{ changeName: "gone", at: 1 }} />);

    await screen.findByTestId("pipeline-node-alpha");
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(document.querySelector("[data-focused]")).toBeNull();
  });
});

describe("shownCardOf", () => {
  it("reads the change a request names, and nothing from any other message", () => {
    expect(shownCardOf({ type: "openspec-ui/show-card", changeName: "alpha" })).toBe("alpha");
    expect(shownCardOf({ type: "openspec-ui/pipeline-changed", changeName: "alpha" })).toBeUndefined();
    expect(shownCardOf({ type: "openspec-ui/show-card" })).toBeUndefined();
    expect(shownCardOf("openspec-ui/show-card")).toBeUndefined();
  });
});
