import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHead } from "./PageHead.js";

// the-shell-wears-the-site-frame 2.8
describe("PageHead", () => {
  it("names the page in its one level-one heading, under a tagline, with what the page is for", () => {
    render(<PageHead head={{ tagline: "Workspace", icon: "task", title: "OpenSpec view summary", sentence: "A parsed summary." }} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("OpenSpec view summary");
    const head = screen.getByTestId("page-head");
    expect(head.querySelector(".openspec-page-head-tagline")).toHaveTextContent("Workspace");
    expect(head.querySelector(".openspec-page-head-tagline [aria-hidden='true']")).not.toBeNull();
    expect(head).toHaveTextContent("A parsed summary.");
  });
});
