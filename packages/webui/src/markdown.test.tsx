import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInlineMarkdown, renderMarkdown } from "./markdown.js";

function renderText(text: string) {
  const { container } = render(<>{renderInlineMarkdown(text)}</>);
  return container;
}

describe("renderInlineMarkdown", () => {
  it("renders **bold** as <strong>", () => {
    const container = renderText("The system **SHALL** provide the protocol.");
    expect(container.querySelector("strong")).toHaveTextContent("SHALL");
  });

  it("renders `code` spans as <code>", () => {
    const container = renderText("The `implement` command has started.");
    expect(container.querySelector("code")).toHaveTextContent("implement");
  });

  it("handles multiple tokens and plain text in between", () => {
    const container = renderText("**SHALL NOT** run `rm -rf` ever.");
    expect(container.querySelector("strong")).toHaveTextContent("SHALL NOT");
    expect(container.querySelector("code")).toHaveTextContent("rm -rf");
    expect(container).toHaveTextContent("ever.");
  });

  it("returns plain text unchanged when there is no markdown", () => {
    const container = renderText("just plain text");
    expect(container).toHaveTextContent("just plain text");
    expect(container.querySelector("strong")).toBeNull();
    expect(container.querySelector("code")).toBeNull();
  });
});

describe("renderMarkdown", () => {
  it("renders heading, task list and fenced code block", () => {
    const md = [
      "# Title",
      "",
      "- [x] done",
      "- [ ] todo",
      "",
      "```ts",
      "const x = 1;",
      "```",
    ].join("\n");

    const { container } = render(<>{renderMarkdown(md)}</>);
    expect(container.querySelector("h1")).toHaveTextContent("Title");
    expect(container.querySelectorAll("input[type='checkbox']").length).toBe(2);
    expect(container.querySelector("pre code")).toHaveTextContent("const x = 1;");
  });
});
