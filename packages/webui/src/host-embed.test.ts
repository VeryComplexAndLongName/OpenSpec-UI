import { describe, expect, it } from "vitest";
import { ALL_TABS, ALLOWED_TABS_VSCODE_EMBED, computeVisibleTabs, embedTheme, initialTab, readEmbedSignal } from "./host-embed.js";

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
  it("returns every tab for a plain standalone browser tab (no embed signal)", () => {
    expect(computeVisibleTabs("")).toEqual(ALL_TABS);
  });

  it("returns only the allowed subset for the VS Code local-server embed, in ALL_TABS order", () => {
    const visible = computeVisibleTabs("vscode-local-server");
    expect(visible.map((tab) => tab.id)).toEqual(["run-a-command", "pipeline"]);
    expect(visible.map((tab) => tab.id)).toEqual([...ALLOWED_TABS_VSCODE_EMBED]);
  });

  it("returns all nine tabs for a plain browser tab", () => {
    expect(computeVisibleTabs("").map((tab) => tab.id)).toHaveLength(9);
  });

  it("treats any other embed value as a plain standalone tab", () => {
    expect(computeVisibleTabs("something-else")).toEqual(ALL_TABS);
  });
});

describe("initialTab", () => {
  const embeddedTabs = computeVisibleTabs("vscode-local-server");

  it("returns the tab named by `tab=` when it is visible", () => {
    expect(initialTab("?tab=pipeline", embeddedTabs)).toBe("pipeline");
  });

  it("returns the first visible tab when `tab=` names a hidden tab", () => {
    expect(initialTab("?tab=templates", embeddedTabs)).toBe("run-a-command");
  });

  it("returns the first visible tab when `tab=` names an unknown tab", () => {
    expect(initialTab("?tab=does-not-exist", embeddedTabs)).toBe("run-a-command");
  });

  it("returns the first visible tab when no `tab=` parameter is present", () => {
    expect(initialTab("", embeddedTabs)).toBe("run-a-command");
  });
});

// the-pipeline-answers-while-a-run-works 5.7
describe("embedTheme", () => {
  it("reads the light or dark a framing editor names", () => {
    expect(embedTheme("?embed=vscode-local-server&tab=pipeline&theme=dark")).toBe("dark");
    expect(embedTheme("?theme=light")).toBe("light");
  });

  it("names nothing for an absent or unknown theme", () => {
    expect(embedTheme("")).toBeUndefined();
    expect(embedTheme("?theme=solarized")).toBeUndefined();
  });
});
