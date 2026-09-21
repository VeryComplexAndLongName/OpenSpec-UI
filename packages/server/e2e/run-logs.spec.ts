// A change's card opens its run logs (a-change-shows-its-run-logs): the
// logs core wrote for two runs, listed from the card's Logs button, the
// newest shown, and the older one on request.
//
// The logs are written by core's own writer, not by hand, so what the page
// reads is what a run leaves.

import { expect, test } from "@playwright/test";
import { rm } from "node:fs/promises";
import { createFileRunLogs } from "@openspec-ui/core";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { createDatedWorkspace } from "./fixtures/create-dated-workspace.js";

test.describe("standalone run logs", () => {
  let workspaceRoot: string;

  test.afterEach(async () => {
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  test("opens a change's runs from its card, newest first, and shows what each said", async ({ page }) => {
    test.setTimeout(90000);
    workspaceRoot = await createDatedWorkspace([{ name: "still-open", proposedOn: "2026-03-04" }]);

    const logs = createFileRunLogs(workspaceRoot);
    const older = logs.open({ runId: "run-older", agent: "claude-cli", kind: "plan", cwd: workspaceRoot, changeName: "still-open" });
    older.event({ kind: "stdout", runId: "run-older", timestamp: "2026-09-21T09:00:01.000Z", chunk: "planned three tasks" });
    await older.end({ outcome: "completed", summary: "a plan" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const newer = logs.open({ runId: "run-newer", agent: "claude-cli", kind: "chain", cwd: workspaceRoot, changeName: "still-open", stage: "apply" });
    newer.event({ kind: "stdout", runId: "run-newer", timestamp: "2026-09-21T10:00:01.000Z", chunk: "compiling " });
    newer.event({ kind: "stdout", runId: "run-newer", timestamp: "2026-09-21T10:00:01.100Z", chunk: "done" });
    newer.event({ kind: "stderr", runId: "run-newer", timestamp: "2026-09-21T10:00:02.000Z", chunk: "1 test failing" });
    await newer.end({ outcome: "failed", reason: "tests failed" });

    const server: OpenSpecUiServer = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
    const address = await server.listen();
    try {
      await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
      await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
      await page.getByRole("tab", { name: "Pipeline" }).click();

      await page.getByRole("button", { name: "Logs of still-open" }).click({ timeout: 60000 });

      const view = page.getByRole("dialog", { name: "Logs of still-open" });
      await expect(view.getByTestId("run-logs-list").locator("tbody tr")).toHaveCount(2);
      await expect(view.getByTestId("run-logs-run-run-newer")).toContainText("tests failed");
      // The newest first, and shown without being asked.
      await expect(view.getByTestId("run-log")).toContainText("compiling done");
      await expect(view.getByTestId("run-log")).toContainText("1 test failing");

      await view.getByTestId("run-logs-run-run-older").getByRole("button").click();
      await expect(view.getByTestId("run-log")).toContainText("planned three tasks");

      await view.getByTestId("run-logs-close").click();
      await expect(view).toHaveCount(0);
    } finally {
      await server.close();
    }
  });
});
