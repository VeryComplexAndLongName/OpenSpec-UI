import { expect, test } from "@playwright/test";
import { rm } from "node:fs/promises";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { loadAndSelectChange } from "./fixtures/ai-panel-actions.js";
import { createLifecycleWorkspace } from "./fixtures/create-lifecycle-workspace.js";
import { createFakeAgentRunner } from "./fixtures/fake-agent-runner.js";
import { interceptWebSocket } from "./fixtures/intercept-websocket.js";

const CHANGE_NAME = "lifecycle-run";

test.describe("standalone lifecycle: execution", () => {
  let workspaceRoot: string;

  test.afterEach(async () => {
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
  });

  test("a mutating run's events render in the order they occurred", async ({ page }) => {
    test.setTimeout(60000);
    workspaceRoot = await createLifecycleWorkspace(CHANGE_NAME);
    const server = createServer({
      workspaceRoot,
      host: "127.0.0.1",
      port: 0,
      runners: new Map([["claude-cli", createFakeAgentRunner({ changeName: CHANGE_NAME })]]),
    });
    const address = await server.listen();
    const socket = await interceptWebSocket(page);
    try {
      const pageErrors: Error[] = [];
      page.on("pageerror", (error) => pageErrors.push(error));

      await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
      await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
      await loadAndSelectChange(page, CHANGE_NAME);

      await page.getByTestId("command-picker").selectOption("implement");
      await page.getByTestId("run-button").click();

      await expect(page.getByTestId("run-status-label")).toContainText("Completed", { timeout: 15000 });

      const events = page.locator('[data-testid="event-log"] > li');
      await expect(events).toHaveCount(4);
      const classes = await events.evaluateAll((elements) => elements.map((element) => element.className));
      expect(classes).toEqual([
        "openspec-event openspec-event--started",
        "openspec-event openspec-event--progress",
        "openspec-event openspec-event--stdout",
        "openspec-event openspec-event--completed",
      ]);

      expect(pageErrors).toEqual([]);
    } finally {
      // See fixtures/intercept-websocket.ts: the browser's WebSocket is
      // still open at this point (FetchTransport never closes it on its
      // own), and `server.close()` waits for every connected client to
      // disconnect -- closing the client side first is what actually
      // lets it resolve instead of hanging for the rest of the test
      // timeout.
      await socket.current?.close();
      await server.close();
    }
  });

  test("a dropped connection during a run does not crash the page", async ({ page }) => {
    test.setTimeout(60000);
    workspaceRoot = await createLifecycleWorkspace(CHANGE_NAME);
    const server = createServer({
      workspaceRoot,
      host: "127.0.0.1",
      port: 0,
      runners: new Map([["claude-cli", createFakeAgentRunner({
        changeName: CHANGE_NAME,
        implementGate: new Promise(() => undefined), // never resolves: run stays in progress
      })]]),
    });
    const address = await server.listen();
    const socket = await interceptWebSocket(page);
    try {
      const pageErrors: Error[] = [];
      page.on("pageerror", (error) => pageErrors.push(error));

      await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
      await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
      await loadAndSelectChange(page, CHANGE_NAME);

      await page.getByTestId("command-picker").selectOption("implement");
      await page.getByTestId("run-button").click();

      // Let the started/progress/stdout events actually arrive before
      // severing the connection, so this proves a mid-run drop, not a
      // connection that never delivered anything.
      await expect(page.locator('[data-testid="event-log"] > li')).toHaveCount(3, { timeout: 15000 });

      await socket.current?.close();

      // No further events can arrive (the run's `completed` event was
      // never sent) and the page must not throw -- there is no reconnect
      // to prove here (see design.md), only that the drop is silent and
      // non-crashing.
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="event-log"] > li')).toHaveCount(3);
      await expect(page.getByTestId("run-status-label")).toContainText("Loading");
      expect(pageErrors).toEqual([]);
    } finally {
      await server.close();
    }
  });

  test("a server stopped mid-run has no record of that run on restart", async ({ page }) => {
    test.setTimeout(60000);
    workspaceRoot = await createLifecycleWorkspace(CHANGE_NAME);
    let server: OpenSpecUiServer | undefined = createServer({
      workspaceRoot,
      host: "127.0.0.1",
      port: 0,
      runners: new Map([["claude-cli", createFakeAgentRunner({
        changeName: CHANGE_NAME,
        implementGate: new Promise(() => undefined), // never resolves: the run is still "in progress" when killed
      })]]),
    });
    const address = await server.listen();
    const socket = await interceptWebSocket(page);
    try {
      await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
      await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
      await loadAndSelectChange(page, CHANGE_NAME);

      await page.getByTestId("command-picker").selectOption("implement");
      await page.getByTestId("run-button").click();
      await expect(page.locator('[data-testid="event-log"] > li')).toHaveCount(3, { timeout: 15000 });

      // Stand in for a real process kill (see design.md): sever the
      // client's connection (as a real crash would leave it, from the
      // client's point of view) and shut this server down -- nothing the
      // WS `implement` path wasn't already only going to persist at
      // completion is lost either way (WorkbenchRecoveryService.runMutating()).
      await socket.current?.close();
      await server.close();
      server = undefined;

      const restarted = createServer({
        workspaceRoot,
        host: "127.0.0.1",
        port: 0,
        runners: new Map([["claude-cli", createFakeAgentRunner({ changeName: CHANGE_NAME })]]),
      });
      const restartedAddress = await restarted.listen();
      try {
        await page.goto(`http://127.0.0.1:${restartedAddress.port}/#token=${encodeURIComponent(restarted.accessToken)}`);
        await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
        await page.getByRole("tab", { name: "Processes and Recovery" }).click();
        await expect(page.getByTestId("processes-view")).toContainText("No persisted processes.", { timeout: 15000 });
      } finally {
        await restarted.close();
      }
    } finally {
      // Only reached if an earlier assertion in this test threw before the
      // deliberate kill above ran -- the client-side close is still needed
      // first, or this would hang instead of reporting the real failure.
      if (server) {
        await socket.current?.close();
        await server.close();
      }
    }
  });
});
