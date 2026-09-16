// A tab that is reading says so, holds its controls, and shows a spinner on
// its label while it reads, whichever tab is open
// (a-screen-says-what-it-is-doing 3.16).
//
// The owner reported a tab standing blank for a minute with nothing to tell
// working from broken. The rule for which tab reads is unit-tested in
// `tab-readings.test.ts`; this asserts the shell reaches it, in a browser,
// with a reading held open on purpose: the overview request is kept waiting
// until the test lets it go, so nothing here depends on how slow a machine
// happens to be.

import { expect, test } from "@playwright/test";
import { rm } from "node:fs/promises";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { createLifecycleWorkspace } from "./fixtures/create-lifecycle-workspace.js";

const CHANGE_NAME = "reading-fixture";
const OVERVIEW_READING = "Reading the workspace's changes and specs…";

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

test("says what the summary is reading, holds its controls and marks its tab, until the reading returns", async ({ page }) => {
  test.setTimeout(90_000);
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/overview", async (route) => {
    await held;
    await route.continue();
  });

  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await page.getByRole("tab", { name: "OpenSpec view summary" }).click();

  const status = page.getByTestId("tab-reading-overview");
  await expect(status.getByRole("status")).toHaveText(OVERVIEW_READING);
  // The fieldset that holds the tab's controls, and the tab's own Refresh,
  // which sits in the page head since the-summary-looks-like-the-mockup and
  // holds itself while the overview is read.
  const controls = page.getByTestId("page-tab-panel-overview").getByRole("group").first();
  await expect(controls).toHaveAttribute("aria-busy", "true");
  await expect(page.getByTestId("summary-refresh")).toBeDisabled();
  await expect(page.getByTestId("page-tab-spinner-overview")).toBeVisible();
  // Its label is unchanged: the spinner is hidden from assistive technology.
  await expect(page.getByRole("tab", { name: "OpenSpec view summary" })).toBeVisible();

  // Left while it reads, the tab still shows it is busy.
  await page.getByRole("tab", { name: "Harness Settings" }).click();
  await expect(page.getByTestId("page-tab-spinner-overview")).toBeVisible();

  release();

  await expect(page.getByTestId("page-tab-spinner-overview")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("tab", { name: "OpenSpec view summary" }).click();
  await expect(page.getByTestId("tab-reading-overview")).toHaveCount(0);
  await expect(page.getByTestId("openspec-overview")).toContainText(CHANGE_NAME, { timeout: 30_000 });
  await expect(controls).toHaveAttribute("aria-busy", "false");
  await expect(page.getByTestId("summary-refresh")).toBeEnabled();
});
