import { expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";
const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);
const dispatch = vi.fn(async () => ({ observations: [] }));
vi.mock("@openspec-ui/core", () => ({ dispatchCompliance: dispatch }));
const { CompliancePanel } = await import("./compliance-panel.js");

it("opens without a check and forwards bridge requests using the host-owned root", async () => {
  let receive: (message: unknown) => void = () => {};
  const panel = {
    webview: { html: "", cspSource: "vscode-webview:", asWebviewUri: (uri: unknown) => uri,
      onDidReceiveMessage: (listener: (message: unknown) => void) => { receive = listener; return { dispose: vi.fn() }; },
      postMessage: vi.fn(async () => true) }, reveal: vi.fn(), onDidDispose: vi.fn(), dispose: vi.fn(),
  };
  vscodeMock.window.createWebviewPanel.mockReturnValue(panel);
  const view = new CompliancePanel(vscodeMock.Uri.file("/extension") as never, () => "/repo");
  view.show();
  expect(dispatch).not.toHaveBeenCalled();
  expect(panel.webview.html).toContain("default-src 'none'");
  receive({ type: "compliance", id: "one", request: { op: "read", cwd: "/foreign" } });
  await vi.waitFor(() => expect(panel.webview.postMessage).toHaveBeenCalled());
  expect(dispatch).toHaveBeenCalledWith("/repo", { op: "read", cwd: "/foreign" });
  view.show();
  expect(panel.reveal).toHaveBeenCalledTimes(1);
  view.dispose();
});