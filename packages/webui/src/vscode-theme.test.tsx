import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isDarkEditorTheme, metroRootClassName, useEditorDarkTheme } from "./vscode-theme.js";

function classes(...names: string[]) {
  const element = document.createElement("body");
  element.className = names.join(" ");
  return element.classList;
}

describe("the editor theme a webview follows", () => {
  it("reads dark and high-contrast dark as dark, and light and high-contrast light as light", () => {
    expect(isDarkEditorTheme(classes("vscode-dark"))).toBe(true);
    expect(isDarkEditorTheme(classes("vscode-high-contrast"))).toBe(true);
    expect(isDarkEditorTheme(classes("vscode-light"))).toBe(false);
    expect(isDarkEditorTheme(classes("vscode-high-contrast-light"))).toBe(false);
    // VS Code has put both classes on a high-contrast light body.
    expect(isDarkEditorTheme(classes("vscode-high-contrast", "vscode-high-contrast-light"))).toBe(false);
    expect(isDarkEditorTheme(classes())).toBe(false);
  });

  it("gives the root Metro's dark palette only when the editor is dark", () => {
    expect(metroRootClassName("openspec-extension-app", true)).toBe("openspec-extension-app openspec-metro dark-side");
    expect(metroRootClassName("openspec-extension-app", false)).toBe("openspec-extension-app openspec-metro");
  });

  it("follows a theme switched while the webview is open", async () => {
    const body = document.createElement("body");
    body.className = "vscode-light";
    const readBody = () => body;
    function Root() {
      const dark = useEditorDarkTheme(readBody);
      return <div data-testid="root" className={metroRootClassName("openspec-extension-app", dark)} />;
    }
    render(<Root />);
    expect(screen.getByTestId("root")).not.toHaveClass("dark-side");

    await act(async () => {
      body.className = "vscode-dark";
    });
    expect(screen.getByTestId("root")).toHaveClass("dark-side");

    await act(async () => {
      body.className = "vscode-high-contrast vscode-high-contrast-light";
    });
    expect(screen.getByTestId("root")).not.toHaveClass("dark-side");
  });
});
