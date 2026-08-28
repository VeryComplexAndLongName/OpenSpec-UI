import { expect, test } from "@playwright/test";
import { rm } from "node:fs/promises";
import { createServer } from "../src/server.js";
import { loadAndSelectChange } from "./fixtures/ai-panel-actions.js";
import { createLifecycleWorkspace } from "./fixtures/create-lifecycle-workspace.js";
import { createFakeAgentRunner } from "./fixtures/fake-agent-runner.js";

const CHANGE_NAME = "concurrent-hosts-change";

test("a second host's mutating run is blocked by an active workspace lease", async ({ browser }) => {
  test.setTimeout(60000);
  const workspaceRoot = await createLifecycleWorkspace(CHANGE_NAME);

  // Two independent server processes (real ports, real cross-host
  // workspace lease -- docs/adr/0010-cross-host-workspace-lease.md)
  // against the same real workspace root: one browser context each,
  // simulating two users/hosts of the standalone app.
  let releaseFirstRun!: () => void;
  const firstRunGate = new Promise<void>((resolve) => { releaseFirstRun = resolve; });
  const firstServer = createServer({
    workspaceRoot,
    host: "127.0.0.1",
    port: 0,
    runners: new Map([["claude-cli", createFakeAgentRunner({ changeName: CHANGE_NAME, implementGate: firstRunGate })]]),
  });
  const secondServer = createServer({
    workspaceRoot,
    host: "127.0.0.1",
    port: 0,
    runners: new Map([["claude-cli", createFakeAgentRunner({ changeName: CHANGE_NAME })]]),
  });

  try {
    const firstAddress = await firstServer.listen();
    const secondAddress = await secondServer.listen();

    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
    try {
      const firstPage = await firstContext.newPage();
      const secondPage = await secondContext.newPage();

      await firstPage.goto(`http://127.0.0.1:${firstAddress.port}/#token=${encodeURIComponent(firstServer.accessToken)}`);
      await firstPage.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
      await loadAndSelectChange(firstPage, CHANGE_NAME);
      await firstPage.getByTestId("command-picker").selectOption("implement");
      await firstPage.getByTestId("run-button").click();
      // The lease is only acquired once the scheduler's mutating branch
      // runs, which is exactly when `started` is emitted -- wait for it
      // so the second host's attempt below genuinely races a held lease.
      await expect(firstPage.locator('[data-testid="event-log"] > li').first()).toHaveClass(/openspec-event--started/, { timeout: 15000 });

      await secondPage.goto(`http://127.0.0.1:${secondAddress.port}/#token=${encodeURIComponent(secondServer.accessToken)}`);
      await secondPage.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
      await loadAndSelectChange(secondPage, CHANGE_NAME);
      await secondPage.getByTestId("command-picker").selectOption("implement");
      await secondPage.getByTestId("run-button").click();

      await expect(secondPage.getByTestId("run-status-label")).toContainText("Failed", { timeout: 15000 });
      await expect(secondPage.getByTestId("run-status-label")).toContainText("standalone server");

      releaseFirstRun();
      await expect(firstPage.getByTestId("run-status-label")).toContainText("Completed", { timeout: 15000 });

      // The lease is released now -- a fresh run from the second host
      // succeeds.
      const secondRunId = secondPage.getByTestId("run-button");
      await secondRunId.click();
      await expect(secondPage.getByTestId("run-status-label")).toContainText("Completed", { timeout: 15000 });
    } finally {
      await firstContext.close();
      await secondContext.close();
    }
  } finally {
    await firstServer.close();
    await secondServer.close();
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
