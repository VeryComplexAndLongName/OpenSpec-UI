import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInlineMarkdown } from "./markdown.js";

function renderText(text: string) {
  const { container } = render(<>{renderInlineMarkdown(text)}</>);
  return container;
}

describe("renderInlineMarkdown", () => {
  it("renders **bold** as <strong>", () => {
    const container = renderText("Система **SHALL** предоставлять протокол.");
    expect(container.querySelector("strong")).toHaveTextContent("SHALL");
  });

  it("renders `code` spans as <code>", () => {
    const container = renderText("Команда `implement` запущена.");
    expect(container.querySelector("code")).toHaveTextContent("implement");
  });

  it("handles multiple tokens and plain text in between", () => {
    const container = renderText("**SHALL NOT** запускать `rm -rf` никогда.");
    expect(container.querySelector("strong")).toHaveTextContent("SHALL NOT");
    expect(container.querySelector("code")).toHaveTextContent("rm -rf");
    expect(container).toHaveTextContent("никогда.");
  });

  it("returns plain text unchanged when there is no markdown", () => {
    const container = renderText("just plain text");
    expect(container).toHaveTextContent("just plain text");
    expect(container.querySelector("strong")).toBeNull();
    expect(container.querySelector("code")).toBeNull();
  });
});
