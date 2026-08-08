import { describe, expect, it } from "vitest";
import { shellThemeCss, vscodeThemeCss } from "./shell-ui.js";

describe("shell themes", () => {
  it("keeps VS Code variables in an extension-only override layer", () => {
    expect(shellThemeCss).not.toContain("--vscode-editor-background");
    expect(vscodeThemeCss).toContain("--vscode-editor-background");
    expect(vscodeThemeCss).toContain("--vscode-editor-foreground");
    expect(vscodeThemeCss).toContain("--vscode-input-background");
    expect(vscodeThemeCss).toContain("--vscode-focusBorder");
    expect(vscodeThemeCss).toContain("color-scheme: light dark");
  });
});
