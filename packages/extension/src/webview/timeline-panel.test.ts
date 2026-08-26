import { describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const { TimelineWebviewPanel } = await import("./timeline-panel.js");

function createPanelFixture() {
  const webview = {
    cspSource: "vscode-webview:",
    html: "",
    asWebviewUri: vi.fn((uri: { toString(): string }) => uri),
  };
  const panel = { webview };
  vscodeMock.window.createWebviewPanel.mockReturnValue(panel);
  return panel;
}

function createTimelinePanel() {
  return new TimelineWebviewPanel({ extensionUri: vscodeMock.Uri.file("/extension") as never });
}

/** Extracts the `nonce="..."` attribute from the first inline `<script>`
 * tag that has one (the data-injection script, not the external
 * `<script src=...>` tag, which has no nonce attribute). */
function extractInlineScriptNonce(html: string): string | undefined {
  return html.match(/<script nonce="([^"]+)">window\./)?.[1];
}

describe("TimelineWebviewPanel", () => {
  it("embeds the change timeline behind a CSP nonce, not 'unsafe-inline'", () => {
    const panel = createPanelFixture();
    const timelinePanel = createTimelinePanel();

    timelinePanel.show("my-change", { changeName: "my-change" } as never, 14);

    // The inline data-injection script must carry a nonce that also
    // appears in the CSP's script-src — without it, a real VS Code
    // webview's CSP silently blocks the inline script (no console
    // error visible to the user), leaving window.__OPENSPEC_UI_TIMELINE__
    // unset and the page rendering "No timeline data." forever. A
    // blanket 'unsafe-inline' would also fix this, but weakens CSP for
    // every other inline script on the page — a nonce scopes the
    // exception to only this one script.
    const nonce = extractInlineScriptNonce(panel.webview.html);
    expect(nonce).toBeTruthy();
    expect(panel.webview.html).toContain(`script-src vscode-webview: 'nonce-${nonce}'`);
    expect(panel.webview.html).not.toContain("script-src vscode-webview: 'unsafe-inline'");
    expect(panel.webview.html).toContain('window.__OPENSPEC_UI_TIMELINE__ = {"changeName":"my-change"}');
    expect(panel.webview.html).toContain("window.__OPENSPEC_UI_STALE_THRESHOLD_DAYS__ = 14;");
  });

  it("embeds the multi-change payload behind a CSP nonce", () => {
    const panel = createPanelFixture();
    const timelinePanel = createTimelinePanel();

    timelinePanel.showMulti({ timelines: [], rangeStart: "2026-01-01T00:00:00.000Z", rangeEnd: "2026-01-02T00:00:00.000Z" });

    const nonce = extractInlineScriptNonce(panel.webview.html);
    expect(nonce).toBeTruthy();
    expect(panel.webview.html).toContain(`script-src vscode-webview: 'nonce-${nonce}'`);
    expect(panel.webview.html).toContain("window.__OPENSPEC_UI_MULTI_TIMELINE__ =");
  });

  it("uses a different nonce for each panel", () => {
    const panel = createPanelFixture();
    const timelinePanel = createTimelinePanel();

    timelinePanel.show("first", { changeName: "first" } as never, 14);
    const firstHtml = panel.webview.html;
    timelinePanel.show("second", { changeName: "second" } as never, 14);
    const secondHtml = panel.webview.html;

    expect(extractInlineScriptNonce(firstHtml)).not.toBe(extractInlineScriptNonce(secondHtml));
  });

  it("escapes an embedded </script> sequence so it cannot close the script tag early", () => {
    const panel = createPanelFixture();
    const timelinePanel = createTimelinePanel();

    timelinePanel.show("my-change", { changeName: "my-change", proposal: "</script><script>alert(1)</script>" } as never, 14);

    // Escaping every literal `<` to `\u003c` is sufficient on its own —
    // the HTML tokenizer's script-end-tag detection requires a real `<`
    // character, so the raw substring `</script` (which would end the
    // legitimate data-injection script early) must not appear anywhere.
    expect(panel.webview.html).not.toContain("</script><script>alert(1)");
    expect(panel.webview.html).toContain("\\u003c/script>\\u003cscript>alert(1)\\u003c/script>");
  });
});
