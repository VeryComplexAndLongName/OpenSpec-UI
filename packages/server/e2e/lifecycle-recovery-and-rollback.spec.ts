import { expect, test } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "../src/server.js";
import { seedInterruptedRun } from "./fixtures/seed-interrupted-run.js";

const CHANGE_NAME = "recovery-change";
const RELATIVE_FILE_PATH = "tracked.txt";

test("an interrupted run's recovery and rollback are reviewable in the browser", async ({ page }) => {
  test.setTimeout(60000);
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-recovery-"));

  try {
    await seedInterruptedRun({
      root: workspaceRoot,
      relativeFilePath: RELATIVE_FILE_PATH,
      beforeContent: "before\n",
      afterContent: "after\n",
      changeName: CHANGE_NAME,
    });

    const server = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
    const address = await server.listen();
    try {
      await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
      await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
      await page.getByRole("tab", { name: "Processes and Recovery" }).click();

      const row = page.locator("tr", { hasText: CHANGE_NAME });
      await expect(row).toContainText("interrupted", { timeout: 15000 });
      await row.getByRole("button", { name: "Review" }).click();

      await expect(page.locator(".openspec-process-details h3")).toContainText("implement: interrupted");
      await expect(page.locator(".openspec-process-details")).toContainText(`modified: ${RELATIVE_FILE_PATH}`);

      const rollbackButton = page.getByRole("button", { name: "Rollback files" });
      await expect(rollbackButton).toBeEnabled();
      await rollbackButton.click();

      await expect(page.getByRole("status")).toContainText("Rollback restored 1 files.", { timeout: 15000 });
      await expect.poll(() => readFile(path.join(workspaceRoot, RELATIVE_FILE_PATH), "utf8")).toBe("before\n");
    } finally {
      await server.close();
    }
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
