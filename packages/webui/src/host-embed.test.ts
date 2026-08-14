import { describe, expect, it } from "vitest";
import { ALL_TABS, ALLOWED_TABS_VSCODE_EMBED, computeVisibleTabs, readEmbedSignal } from "./host-embed.js";

describe("readEmbedSignal", () => {
  it("reads the embed query parameter", () => {
    expect(readEmbedSignal("?embed=vscode-local-server")).toBe("vscode-local-server");
  });

  it("returns an empty string when absent", () => {
    expect(readEmbedSignal("")).toBe("");
    expect(readEmbedSignal("?token=abc")).toBe("");
  });
});

describe("computeVisibleTabs", () => {
  it("returns all five tabs for a plain standalone browser tab (no embed signal)", () => {
    expect(computeVisibleTabs("")).toEqual(ALL_TABS);
  });

  it("returns only the allowed subset for the VS Code local-server embed", () => {
    const visible = computeVisibleTabs("vscode-local-server");
    expect(visible.map((tab) => tab.id)).toEqual([...ALLOWED_TABS_VSCODE_EMBED]);
  });

  it("treats any other embed value as a plain standalone tab", () => {
    expect(computeVisibleTabs("something-else")).toEqual(ALL_TABS);
  });
});
