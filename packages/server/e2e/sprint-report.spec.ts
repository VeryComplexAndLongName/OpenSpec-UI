// The sprint report's tab opens from the click that asks for it, says
// what it is waiting for, and becomes the report when the answer comes.
//
// The tab used to be opened after the request. A browser lets a page open
// a tab only while it answers a click, and over the whole archive the
// report took two minutes on this repository, so the tab was refused and
// the wait ended in nothing. The request is held here until the waiting
// tab has been seen, which is exactly that shape without the two minutes.
//
// See openspec/changes/the-sprint-report-reads-like-the-timeline.

import { expect, test } from "@playwright/test";
import { rm } from "node:fs/promises";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { createDatedWorkspace } from "./fixtures/create-dated-workspace.js";

test.describe("standalone sprint report", () => {
  let workspaceRoot: string;

  test.afterEach(async () => {
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  test("opens its tab at the click, and fills it when the report is ready", async ({ page, context }) => {
    test.setTimeout(90000);
    workspaceRoot = await createDatedWorkspace([
      { name: "first-change", proposedOn: "2026-03-01", archivedOn: "2026-03-02" },
      { name: "second-change", proposedOn: "2026-03-02", archivedOn: "2026-03-03" },
    ]);

    const server: OpenSpecUiServer = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
    const address = await server.listen();

    try {
      // Held until released below, so the waiting tab can be looked at.
      let release: () => void = () => undefined;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/sprint-report", async (route) => {
        await released;
        await route.continue();
      });

      await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
      await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
      await page.getByRole("tab", { name: "Timeline" }).click();
      await page.getByRole("button", { name: "Sprint report" }).click();

      await page.getByLabel("Sprint report range start").fill("2026-03-01");
      await page.getByLabel("Sprint report range end").fill("2026-03-05");
      const changes = page.getByLabel("Changes in this sprint");
      await expect(changes.locator("option")).toHaveCount(2, { timeout: 60000 });
      await changes.selectOption([
        { label: "2026-03-02-first-change (archived)" },
        { label: "2026-03-03-second-change (archived)" },
      ]);

      const opening = context.waitForEvent("page");
      await page.getByRole("button", { name: "Open the report" }).click();
      const report = await opening;

      // Before the answer: the tab exists and says what it waits for.
      await expect(report.locator("h1")).toHaveText("Sprint summary");
      await expect(report.locator("body")).toContainText("Reading 2 changes.");
      await expect(page.getByRole("button", { name: "Generating..." })).toBeDisabled();

      release();

      // After it: the same tab is the report.
      await expect(report.getByRole("button", { name: "Print, or save as PDF" })).toBeVisible({ timeout: 60000 });
      await expect(report.locator("body")).toContainText("2026-03-02-first-change");
      await expect(report.locator("body")).toContainText("2026-03-03-second-change");
      await expect(report.locator("body")).not.toContainText("Reading 2 changes.");
      await expect(page.getByRole("button", { name: "Open the report" })).toBeEnabled();
    } finally {
      await server.close();
    }
  });
});
