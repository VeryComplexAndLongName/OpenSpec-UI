// The standalone frame, captured for comparison with ADR 0033's approved
// mockup (the-shell-wears-the-site-frame 4.2): the application bar, the page
// head, the tab row and the footer around the summary tab, at the mockup's
// 1280 pixels, in the light theme and in the dark; then the whole summary
// page in both (the-summary-looks-like-the-mockup 4.2).
//
// Regenerate with (from packages/server):
// `npm run test:browser -- frame-screenshots.spec.ts`.

import { expect, test, type Page } from "@playwright/test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { createLifecycleWorkspace } from "./fixtures/create-lifecycle-workspace.js";

const CHANGE_NAME = "frame-fixture";
const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "images", "standalone");
const MASK_COLOR = "#94a3b8";

let server: OpenSpecUiServer;
let workspaceRoot: string;
let baseUrl: string;

test.beforeAll(async () => {
  workspaceRoot = await createLifecycleWorkspace(CHANGE_NAME);
  server = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await server.close();
  await rm(workspaceRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** The lines that print the fixture's temporary directory, which sits under
 * the home of whoever regenerated the picture. */
function workspacePaths(page: Page) {
  return [page.getByTestId("app-bar-workspace"), page.getByTestId("openspec-overview").locator(".openspec-overview-meta strong").first()];
}

test("captures the frame around the summary, in the light theme and in the dark", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);

  await expect(page.getByTestId("app-bar")).toBeVisible();
  await page.getByRole("tab", { name: "OpenSpec view summary" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("OpenSpec view summary");
  await expect(page.getByTestId("openspec-overview")).toContainText(CHANGE_NAME, { timeout: 30_000 });
  // The content arrives before the last of the overview's readings returns:
  // a picture taken then shows the reading line and every control held.
  await expect(page.getByTestId("tab-reading-overview")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId("summary-refresh")).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole("tab", { name: "OpenSpec view summary" })).toHaveText("Summary");

  const theme = page.getByRole("switch", { name: "Dark theme" });
  if ((await theme.getAttribute("aria-checked")) === "true") await theme.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-openspec-theme", "dark");
  await page.screenshot({ path: path.join(IMAGES_DIR, "frame-light.png"), mask: workspacePaths(page), maskColor: MASK_COLOR });

  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-openspec-theme", "dark");
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((animation) => animation instanceof CSSTransition)
    .map((animation) => animation.finished)));
  await page.screenshot({ path: path.join(IMAGES_DIR, "frame-dark.png"), mask: workspacePaths(page), maskColor: MASK_COLOR });

  // The whole summary, for comparison with the mockup's "Summary" artboards
  // (the-summary-looks-like-the-mockup 4.2).
  await page.screenshot({ path: path.join(IMAGES_DIR, "summary-dark.png"), fullPage: true, mask: workspacePaths(page), maskColor: MASK_COLOR });
  await theme.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-openspec-theme", "dark");
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((animation) => animation instanceof CSSTransition)
    .map((animation) => animation.finished)));
  await page.screenshot({ path: path.join(IMAGES_DIR, "summary-light.png"), fullPage: true, mask: workspacePaths(page), maskColor: MASK_COLOR });
});
