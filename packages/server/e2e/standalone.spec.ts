import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer, type OpenSpecUiServer } from "../src/server.js";

const CHANGE_NAME = "browser-journey";

let server: OpenSpecUiServer;
let workspaceRoot: string;
let baseUrl: string;

test.beforeAll(async () => {
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-browser-"));
  const changeRoot = path.join(workspaceRoot, "openspec", "changes", CHANGE_NAME);
  await mkdir(path.join(changeRoot, "specs", CHANGE_NAME), { recursive: true });
  await mkdir(path.join(workspaceRoot, "openspec", "specs"), { recursive: true });
  await Promise.all([
    writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(path.join(changeRoot, ".openspec.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(path.join(changeRoot, "proposal.md"), "## Why\n\nOriginal proposal.\n", "utf8"),
    writeFile(path.join(changeRoot, "design.md"), "## Context\n\nBrowser fixture.\n", "utf8"),
    writeFile(path.join(changeRoot, "tasks.md"), "## Tasks\n\n- [ ] Browser journey\n", "utf8"),
    writeFile(
      path.join(changeRoot, "specs", CHANGE_NAME, "spec.md"),
      "## ADDED Requirements\n\n### Requirement: Browser fixture\nThe system SHALL load.\n",
      "utf8",
    ),
  ]);

  server = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await server?.close();
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test("loads, edits, and saves an accessible standalone change", async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await expect(page.getByTestId("app-bar")).toBeVisible();

  // The owl marks the page: decorative in the application bar, and the
  // tab's icon, both carried inline. See the-owl-marks-the-app, and
  // the-shell-wears-the-site-frame for the bar it moved into.
  const owl = page.getByTestId("app-bar").locator("img.openspec-shell-logo");
  await expect(owl).toBeVisible();
  await expect(owl).toHaveAttribute("alt", "");
  expect(await owl.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await page.locator('link[rel="icon"]').getAttribute("href")).toMatch(/^data:image\/png;base64,/);

  await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);

  await page.getByRole("tab", { name: "OpenSpec view summary" }).click();
  await page.getByTestId("summary-refresh").click();
  // Overview loading shells out to the `openspec` CLI (listChanges +
  // listSpecs); this flow triggers it up to three times (tab navigation's
  // extra steps mean more elapsed wall-clock time for a spawn to be slow),
  // so the default 5s assertion timeout is too tight on a loaded/slow
  // runner. Generous explicit timeouts here, not a app behavior change.
  await expect(page.getByTestId("openspec-overview")).toContainText(CHANGE_NAME, { timeout: 15000 });

  await page.getByRole("tab", { name: "Change Editor" }).click();
  await page.getByTestId("page-tab-panel-change-editor")
    .getByRole("combobox")
    .selectOption(CHANGE_NAME);
  await page.getByRole("button", { name: "Load change", exact: true }).click();
  await expect(page.getByText(`Loaded ${CHANGE_NAME}.`)).toBeVisible({ timeout: 15000 });

  const proposalEditor = page.getByLabel("Markdown (proposal)");
  await proposalEditor.fill("## Why\n\nUpdated in Chromium.\n");
  await page.getByRole("button", { name: "Save markdown" }).click();
  // Save internally reloads the overview too (see above) before showing
  // this message.
  await expect(page.getByText(`Saved ${CHANGE_NAME}.`)).toBeVisible({ timeout: 15000 });

  const proposalPath = path.join(workspaceRoot, "openspec", "changes", CHANGE_NAME, "proposal.md");
  await expect.poll(() => readFile(proposalPath, "utf8")).toContain("Updated in Chromium.");

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blockingViolations = accessibility.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blockingViolations, JSON.stringify(blockingViolations, null, 2)).toEqual([]);

  // Both palettes meet WCAG AA (the-web-ui-wears-metro, "The standalone
  // shell follows the system theme, and remembers a choice"). The same
  // screen, with the header toggle pressed, is checked again in dark.
  // A switch since a-screen-says-what-it-is-doing: the same name in both
  // states, the state in `aria-checked`.
  const toggle = page.getByRole("switch", { name: "Dark theme" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-openspec-theme", "dark");
  // Metro's controls ease between colours over 0.2s. On a slower CI runner
  // axe measured them half-way, and reported blends that belong to neither
  // palette: #717674 text on #349283. The check waits on the transitions
  // themselves, not on a duration.
  // Transitions only: a tab that is reading spins without end
  // (a-screen-says-what-it-is-doing), and its animation never finishes.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((animation) => animation instanceof CSSTransition)
    .map((animation) => animation.finished)));
  const darkAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const darkBlockingViolations = darkAccessibility.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(darkBlockingViolations, JSON.stringify(darkBlockingViolations, null, 2)).toEqual([]);
  expect(pageErrors).toEqual([]);
});