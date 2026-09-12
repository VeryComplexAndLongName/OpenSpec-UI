// The Pipeline tab in a real browser: that it draws the order the
// repository declares, that a card says what it waits on in words, and
// that the whole screen passes axe at WCAG AA.
//
// The unit tests drive the view with a written report. This drives it
// through the server, against changes on disk, which is the only way to
// see that the shape core derives survives the trip.
//
// Its second product is docs/images/standalone/pipeline.png — generated
// from the running UI, so it cannot silently disagree with it the way a
// manually captured screenshot already had once (see
// harness-screenshots.spec.ts).

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type OpenSpecUiServer } from "../src/server.js";

const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "images", "standalone");

let server: OpenSpecUiServer;
let workspaceRoot: string;
let baseUrl: string;

/** Three changes: one nothing waits on, one that waits on it, and one
 * unrelated. That is both shapes the picture has to draw — a chain and
 * changes side by side — in the smallest fixture that shows them. */
async function writeChange(changeName: string, blockedBy?: string): Promise<void> {
  const changeRoot = path.join(workspaceRoot, "openspec", "changes", changeName);
  await mkdir(path.join(changeRoot, "specs", changeName), { recursive: true });
  const meta = blockedBy
    ? `schema: spec-driven\nblocked_by:\n  - ${blockedBy}\n`
    : "schema: spec-driven\n";
  await Promise.all([
    writeFile(path.join(changeRoot, ".openspec.yaml"), meta, "utf8"),
    writeFile(path.join(changeRoot, "proposal.md"), "## Why\n\nFixture.\n", "utf8"),
    writeFile(path.join(changeRoot, "design.md"), "## Context\n\nFixture.\n", "utf8"),
    writeFile(path.join(changeRoot, "tasks.md"), "## Tasks\n\n- [ ] Fixture\n", "utf8"),
    writeFile(
      path.join(changeRoot, "specs", changeName, "spec.md"),
      "## ADDED Requirements\n\n### Requirement: Fixture\nThe system SHALL load.\n",
      "utf8",
    ),
  ]);
}

test.beforeAll(async () => {
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-pipeline-"));
  await mkdir(path.join(workspaceRoot, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  await writeChange("pipeline-first");
  await writeChange("pipeline-second", "pipeline-first");
  await writeChange("pipeline-unrelated");

  server = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await server?.close();
  // Reading the report runs git inside this directory, and on Windows a
  // process's working directory is locked while it lives — a git that
  // has answered but not yet been reaped leaves the directory busy.
  // Tidying is best-effort: the operating system clears its own temp,
  // and failing a green suite over a leftover directory would be
  // reporting the wrong thing.
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true }).catch(() => undefined);
});

test("draws the declared order, and passes axe", async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await expect(page.getByRole("heading", { name: "OpenSpec UI", level: 1 })).toBeVisible();
  await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);

  await page.getByRole("tab", { name: "Pipeline" }).click();

  // Reading the report lists git worktrees and peeks at each lease, so
  // it is slower than a render; generous, not a behaviour change.
  const blocked = page.getByTestId("pipeline-node-pipeline-second");
  await expect(blocked).toBeVisible({ timeout: 15000 });
  await expect(blocked).toContainText("waiting on pipeline-first");
  await expect(page.getByTestId("pipeline-node-pipeline-first")).toBeVisible();
  await expect(page.getByTestId("pipeline-node-pipeline-unrelated")).toBeVisible();

  // The declared relation is drawn; nothing else is.
  await expect(page.getByTestId("pipeline-edge-pipeline-first-to-pipeline-second")).toBeAttached();

  // A card is a real control, which is what keeps it focusable without
  // any of that having to be supplied by hand (ADR 0025). Asserted by
  // focusing it rather than by its accessible name — the name contains
  // everything the card says, so a change that names another one would
  // match a locator looking for that other one.
  const first = page.getByTestId("pipeline-node-pipeline-first");
  await expect(first).toHaveJSProperty("tagName", "BUTTON");
  await first.focus();
  await expect(first).toBeFocused();

  await page.screenshot({ path: path.join(IMAGES_DIR, "pipeline.png"), fullPage: true });

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blockingViolations = accessibility.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blockingViolations, JSON.stringify(blockingViolations, null, 2)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("becomes headed lanes at phone width, with no lines", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
  await page.getByRole("tab", { name: "Pipeline" }).click();

  await expect(page.getByTestId("pipeline-node-pipeline-first")).toBeVisible({ timeout: 15000 });
  // The cards are still there and still say what they wait on; only the
  // drawing of it is gone, because four columns do not fit a phone.
  await expect(page.getByTestId("pipeline-edges")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Step 1" })).toBeVisible();

  // The page body never scrolls sideways — the picture scrolls in its
  // own container instead.
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
