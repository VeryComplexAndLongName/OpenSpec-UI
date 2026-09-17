// The standalone frame, captured for comparison with ADR 0033's approved
// mockup (the-shell-wears-the-site-frame 4.2): the application bar, the page
// head, the tab row and the footer around the summary tab, at the mockup's
// 1280 pixels, in the light theme and in the dark; then the whole summary
// page in both (the-summary-looks-like-the-mockup 4.2); then Harness Settings
// in both, on a global file set as the mockup's artboard sets it
// (the-harness-settings-look-like-the-mockup 4.2); then the Timeline's one
// change in both (the-change-timeline-looks-like-the-mockup 5.1).
//
// Regenerate with (from packages/server):
// `npm run test:browser -- frame-screenshots.spec.ts`.

import { expect, test, type Page } from "@playwright/test";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { createLifecycleWorkspace } from "./fixtures/create-lifecycle-workspace.js";
import { createTimelineWorkspace, TIMELINE_ARCHIVE_FOLDER, TIMELINE_CHANGE } from "./fixtures/create-timeline-workspace.js";

const CHANGE_NAME = "frame-fixture";
const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "images", "standalone");
const MASK_COLOR = "#94a3b8";

let server: OpenSpecUiServer;
let workspaceRoot: string;
let baseUrl: string;

test.beforeAll(async () => {
  workspaceRoot = await createLifecycleWorkspace(CHANGE_NAME);
  // The stages, models, efforts and run budget the mockup's Harness Settings
  // artboard shows.
  const stage = (model: string, effort: string) => ({ agent: "claude-cli-acp", model, effort });
  await writeFile(
    path.join(workspaceRoot, "openspec", "agent-harness.json"),
    `${JSON.stringify({
      stepAgents: {
        propose: stage("claude-opus-5", "high"),
        review: stage("claude-opus-5", "high"),
        apply: stage("claude-sonnet-5", "medium"),
        verify: stage("claude-opus-5", "high"),
      },
      autonomyLevel: "assisted",
      budget: { maxCostUsd: 15 },
    }, null, 2)}\n`,
    "utf8",
  );
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

test("captures Harness Settings, in the light theme and in the dark", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);

  await expect(page.getByTestId("app-bar")).toBeVisible();
  await page.getByRole("tab", { name: "Harness Settings" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Harness Settings");
  await expect(page.getByLabel("verify model")).toHaveValue("claude-opus-5", { timeout: 30_000 });
  await expect(page.getByTestId("tab-reading-harness-settings")).toHaveCount(0, { timeout: 30_000 });
  // The definitions arrive over their own route; the note about them is part
  // of the picture.
  await expect(page.getByTestId("custom-agent-empty-claude")).toBeVisible({ timeout: 30_000 });
  // Other tabs read in the background and mark their labels while they do;
  // the mockup's tab row has no such marks.
  await expect(page.locator(".openspec-tab-spinner")).toHaveCount(0, { timeout: 60_000 });

  // The note names the directories definitions are read from, under the
  // home of whoever regenerated the picture.
  const paths = () => [page.getByTestId("app-bar-workspace"), page.getByTestId("custom-agent-empty-claude")];
  const theme = page.getByRole("switch", { name: "Dark theme" });
  if ((await theme.getAttribute("aria-checked")) === "true") await theme.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-openspec-theme", "dark");
  await page.screenshot({ path: path.join(IMAGES_DIR, "harness-settings-light.png"), fullPage: true, mask: paths(), maskColor: MASK_COLOR });

  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-openspec-theme", "dark");
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((animation) => animation instanceof CSSTransition)
    .map((animation) => animation.finished)));
  await page.screenshot({ path: path.join(IMAGES_DIR, "harness-settings-dark.png"), fullPage: true, mask: paths(), maskColor: MASK_COLOR });
});

// The Timeline's one-change screen, for comparison with the mockup's
// "Timeline: one change" artboard: a change with a history git can read, in
// the zone the artboard's times are in.
test.describe("the Timeline's one change", () => {
  test.use({ timezoneId: "Europe/Moscow" });
  let timelineServer: OpenSpecUiServer;
  let timelineRoot: string;
  let timelineUrl: string;

  test.beforeAll(async () => {
    timelineRoot = await createTimelineWorkspace();
    timelineServer = createServer({ workspaceRoot: timelineRoot, host: "127.0.0.1", port: 0 });
    const address = await timelineServer.listen();
    timelineUrl = `http://127.0.0.1:${address.port}`;
  });

  test.afterAll(async () => {
    await timelineServer.close();
    await rm(timelineRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  test("captures one change's timeline, in the light theme and in the dark", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${timelineUrl}/#token=${encodeURIComponent(timelineServer.accessToken)}`);

    await expect(page.getByTestId("app-bar")).toBeVisible();
    await page.getByRole("tab", { name: "Timeline" }).click();
    const picker = page.getByTestId("timeline-change-picker");
    await expect(picker).toBeEnabled({ timeout: 30_000 });
    const option = page.getByTestId(`change-picker-option-archived:${TIMELINE_ARCHIVE_FOLDER}`);
    // Found by typing part of its name (the-timeline-finds-a-change), and
    // loaded on choosing: there is no button to press.
    await picker.click();
    await picker.fill("no such change");
    await expect(page.getByTestId("change-picker-count")).toHaveText("No change matches.");
    await picker.fill("which task");
    await expect(option).toHaveText(`${TIMELINE_CHANGE}archived`);
    await option.click();
    await expect(picker).toHaveValue(`${TIMELINE_CHANGE} · archived`);
    await picker.blur();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TIMELINE_CHANGE, { timeout: 30_000 });
    await expect(page.getByTestId("change-timeline-tile")).toContainText("7 / 7");
    await expect(page.getByTestId("change-timeline-tile")).toContainText("proposed to archived in 10 h 07 min");
    await expect(page.getByTestId("timeline-group-toggle-1")).toHaveText("5 tasks ticked in one commit");
    await expect(page.getByTestId("change-timeline-tasks").locator(":scope > li").first().locator("time")).toHaveText("Sun 13 Sep, 18:40");
    await expect(page.getByTestId("timeline-date-proposed")).toContainText("from a git commit");
    await expect(page.getByTestId("tab-reading-timeline")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator(".openspec-tab-spinner")).toHaveCount(0, { timeout: 60_000 });

    const masks = () => [page.getByTestId("app-bar-workspace")];
    const theme = page.getByRole("switch", { name: "Dark theme" });
    if ((await theme.getAttribute("aria-checked")) === "true") await theme.click();
    await expect(page.locator("html")).not.toHaveAttribute("data-openspec-theme", "dark");
    await page.screenshot({ path: path.join(IMAGES_DIR, "timeline-change-light.png"), fullPage: true, mask: masks(), maskColor: MASK_COLOR });

    await theme.click();
    await expect(page.locator("html")).toHaveAttribute("data-openspec-theme", "dark");
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter((animation) => animation instanceof CSSTransition)
      .map((animation) => animation.finished)));
    await page.screenshot({ path: path.join(IMAGES_DIR, "timeline-change-dark.png"), fullPage: true, mask: masks(), maskColor: MASK_COLOR });

    // Choosing again puts the change shown away at once, and the page head
    // stops naming it, while the next reading is held back here.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/change-timeline", async (route) => {
      await held;
      await route.continue();
    });
    await picker.click();
    await picker.fill(TIMELINE_CHANGE);
    await option.click();
    await expect(page.getByTestId("change-timeline-view")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Timeline");
    release();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TIMELINE_CHANGE, { timeout: 30_000 });
  });
});
