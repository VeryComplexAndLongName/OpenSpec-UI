// Produces the editor pictures `packages/extension/README.md` and the
// root `README.md` carry, from a real editor — an-editor-picture-is-taken-too.
//
// These nine were listed as hand-taken, on the reason that no agent can
// drive the editor's own views or capture its window. Measured
// 2026-09-12, that is false: Playwright drives Electron, VS Code is
// Electron, and the binary `@vscode/test-electron` already downloads is
// right there. Launching it, waiting on the workbench, screenshotting
// and masking a region all work.
//
// Regenerate with (from packages/extension): `npm run test:pictures`.
//
// Every capture waits on the DATA that makes the picture worth having,
// never on a duration and never on a pane header. The first attempt at
// this waited for the "Changes" header and produced a picture of six
// views all reading "There is no data provider registered" — green to
// every automated check and useless to a reader. That is the failure
// this discipline exists to prevent.

import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { _electron } from "playwright";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPictureWorkspace, type PictureWorkspace } from "./fixtures/create-picture-workspace.js";

// `__dirname`, not `import.meta`: a VS Code extension package is
// CommonJS, and Playwright transpiles this file into it.
const HERE = __dirname;
const EXTENSION = path.resolve(HERE, "..");
const IMAGES = path.resolve(HERE, "..", "..", "..", "docs", "images", "extension");

/** The editor this repository already downloads for its integration
 * suite. Resolved rather than hard-coded to one version: a version bump
 * should not need an edit here. */
async function findEditor(): Promise<string> {
  const { readdir } = await import("node:fs/promises");
  const testRoot = path.resolve(HERE, "..", "..", "..", ".vscode-test");
  const entries = await readdir(testRoot, { withFileTypes: true });
  const archive = entries.find((entry) => entry.isDirectory() && entry.name.startsWith("vscode-"));
  if (!archive) {
    throw new Error(
      `no VS Code under ${testRoot}. Run the extension's integration suite once to download it.`,
    );
  }
  return path.join(testRoot, archive.name, "Code.exe");
}

/** Written into the editor's own user directory before it starts.
 *
 * Settled in configuration rather than clicked away afterwards: a click
 * can fail silently and leave the chrome in the picture, while a setting
 * either applies or the editor does not start. */
async function writeUserSettings(userDataDir: string, settings: Record<string, unknown>): Promise<void> {
  const file = path.join(userDataDir, "User", "settings.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(settings, null, 2), "utf8");
}

/** Nothing is masked in these pictures, and that is the fixture's doing.
 *
 * The standalone captures mask two path fields because their fixture
 * lives under a temporary path carrying the account name. Here the
 * workspace has a fixed name, so the title bar and the Explorer root
 * carry nothing to hide. A grey rectangle over the top of the editor
 * reads as a rendering fault, which is worse than the thing it hides. */

let app: ElectronApplication;
let window: Page;
let workspace: PictureWorkspace;

test.beforeAll(async () => {
  test.skip(process.platform !== "win32", "The pictures are taken on one machine; a second platform is a second set that would drift apart.");

  workspace = await createPictureWorkspace();

  // Settled before launch rather than clicked away afterwards. A click
  // can fail silently and leave the chrome in the picture; a setting
  // either applies or the editor does not start.
  await writeUserSettings(path.join(workspace.holder, "user"), {
    // The editor opens a chat panel on the right that is not this
    // product and not what the picture is of.
    "workbench.secondarySideBar.defaultVisibility": "hidden",
    "chat.commandCenter.enabled": false,
    // The command centre carries the workspace path.
    "window.commandCenter": false,
    "workbench.startupEditor": "none",
    "workbench.tips.enabled": false,
    "update.mode": "none",
    "telemetry.telemetryLevel": "off",
  });

  app = await _electron.launch({
    executablePath: await findEditor(),
    args: [
      "--no-sandbox",
      "--disable-gpu-sandbox",
      "--disable-updates",
      "--skip-welcome",
      "--skip-release-notes",
      "--disable-workspace-trust",
      `--extensionDevelopmentPath=${EXTENSION}`,
      `--user-data-dir=${path.join(workspace.holder, "user")}`,
      `--extensions-dir=${path.join(workspace.holder, "extensions")}`,
      workspace.path,
    ],
    timeout: 180_000,
  });

  window = await app.firstWindow({ timeout: 180_000 });
  await window.waitForSelector(".monaco-workbench", { timeout: 180_000 });
  await window.setViewportSize({ width: 1440, height: 900 });

  // Open the extension's own container, then wait for a row only its
  // tree can produce. Until that row exists the views are drawn and
  // empty, which photographs as a product that does not work.
  await window.locator('.activitybar [aria-label*="OpenSpec"]').first().click();
  await window.locator('.monaco-list-row:has-text("a-change-in-progress")').first()
    .waitFor({ timeout: 180_000 });

  await quietTheEditor(window);
});

test.afterAll(async () => {
  await app?.close();
  // `close()` returns before Windows releases the editor's own log
  // handles, so a plain remove fails with EBUSY and reports a passing
  // run as failed. Retried, and a failure to tidy a temporary directory
  // is not allowed to fail the run: it costs disk, not correctness.
  if (workspace) {
    await rm(workspace.holder, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
      .catch(() => undefined);
  }
});

/** Takes the pointer out of the picture and lets any tooltip it raised
 * disappear. The first capture carried a floating "OpenSpec UI" label
 * over the Archive view — the tooltip from the click that opened the
 * container, photographed because nothing had moved the mouse away. */
async function settle(page: Page): Promise<void> {
  await page.mouse.move(720, 450);
  await expect(page.locator(".monaco-hover:visible")).toHaveCount(0);
}

/** The account a picture would betray, if any of the fixture's
 * temporary path reached the screen. */
const ACCOUNT = os.userInfo().username;

/** The only way a picture is taken.
 *
 * Every capture passes through here, so this is where a picture that
 * would publish the machine it was taken on is stopped. The fixture sits
 * under a temporary directory whose path carries the account name, and a
 * title, a tree description or a breadcrumb could put it on screen. This
 * fails instead of the picture leaking it — asserted against the one
 * string that would leak, and against rendered text only, since the
 * editor's hidden accessibility regions carry full paths nobody sees. */
async function shoot(file: string): Promise<void> {
  await expect(window.locator(".monaco-workbench")).not.toContainText(ACCOUNT, { useInnerText: true });
  await window.screenshot({ path: path.join(IMAGES, file) });
}

/** Removes the chrome a development host raises that the product does
 * not: the toast about disabled extensions, and the side bar the editor
 * opens on its own. */
async function quietTheEditor(page: Page): Promise<void> {
  for (const close of await page.locator(".notifications-toasts .codicon-notifications-clear").all()) {
    await close.click().catch(() => undefined);
  }
  await page.locator(".part.auxiliarybar .codicon-close").first().click().catch(() => undefined);
  await expect(page.locator(".notifications-toasts .notification-toast")).toHaveCount(0);
}

test.describe("editor documentation screenshots", () => {
  test("the workbench, expanded", async () => {
    await closeEditors();
    // What the README leads with: every view the extension contributes,
    // each with something in it.
    // The caption promises change ARTIFACTS, so a change is opened to show
    // them. Taken with every change collapsed, the first picture carried
    // this caption over a list of names.
    await expandRow("a-change-in-progress");
    await expect(window.locator('.monaco-list-row:has-text("Proposal")').first()).toBeVisible();
    await expect(window.locator('.monaco-list-row:has-text("a-capability")').first()).toBeVisible();

    await settle(window);
    await shoot("overview-expanded.png");
  });

  test("the workbench, compact", async () => {
    await closeEditors();
    // The same views with the trees collapsed, which is what a reader
    // sees before they have opened anything.
    // Re-queried each time: clicking a header toggles it, so a list
    // taken once and iterated would collapse some and expand others.
    for (let remaining = 10; remaining > 0; remaining -= 1) {
      const expanded = window.locator(".pane-header.expanded").first();
      if (await expanded.count() === 0) break;
      await expanded.click();
    }
    await expect(window.locator(".pane-header.expanded")).toHaveCount(0);

    await settle(window);
    await shoot("overview-compact.png");
  });

  test("the Specs tree, listing capabilities and their requirement counts", async () => {
    // The caption mentions no editor, so there must not be one.
    await closeEditors();
    await onlyExpand("Specs");

    // The caption claims the counts. If they are not on screen the
    // picture does not support it, so the capture fails here instead.
    await expect(window.locator('.monaco-list-row:has-text("a-capability")').first()).toContainText("1 requirement");
    await expect(window.locator('.monaco-list-row:has-text("another-capability")').first()).toContainText("1 requirement");

    await settle(window);
    await shoot("specs-list.png");
  });

  test("a spec selected in the tree and open in the editor", async () => {
    await onlyExpand("Specs");
    await window.locator('.monaco-list-row:has-text("a-capability")').first().click();

    // The caption claims both halves: selected in the tree, AND open in
    // the editor. The editor half is the one that can silently not
    // happen, so it is the one waited on.
    await expect(window.locator('.tabs-container [aria-label*="spec.md"]').first()).toBeVisible();
    await expect(window.locator(".editor-instance .view-lines")).toContainText("Requirement");

    // Opening a markdown file activates the editor's markdown support, and
    // until it has, the file is uncoloured and the status bar reads
    // "Activating Extensions…". This photographed that state twice: first
    // with no wait, then with a `toHaveCount(0)` taken the moment the text
    // appeared — before activation had started showing, so it passed and
    // the picture still carried it. So wait for what activation PRODUCES, a
    // heading tokenised as something other than plain text, and check the
    // status bar last, right before the shutter, as a retrying assertion on
    // an element that must exist — a selector matching nothing cannot pass
    // by default that way.
    await expect(window.locator('.editor-instance .view-line span[class^="mtk"]:not(.mtk1)').first()).toBeVisible();

    await settle(window);
    const statusBar = window.locator(".part.statusbar");
    await expect(statusBar).toBeVisible();
    await expect(statusBar).not.toContainText("Activating Extensions");
    await shoot("specs-editor.png");
  });

  test("completed checklist items nested under a change's Tasks artifact", async () => {
    // The caption mentions no editor, so there must not be one. Found by
    // looking at the picture and seeing a `spec.md` the caption never
    // claims — left open by the capture before it.
    await closeEditors();
    await onlyExpand("Changes");
    await expandRow("a-change-in-progress");
    await expandRow("Tasks");

    // The caption is specifically about COMPLETED items nested under
    // Tasks. A tree that expanded but has not loaded its children shows
    // neither, and would photograph as a feature that does nothing.
    await expect(window.locator('.monaco-list-row:has-text("Something already done")').first()).toBeVisible();

    await settle(window);
    await shoot("nested-tasks.png");
  });

  test("the Repository Setup tree and what it offers", async () => {
    await closeEditors();
    await onlyExpand("Changes");
    // Not part of this caption, and left expanded by an earlier capture.
    await collapseRow("a-change-in-progress");
    await expandRow("Repository Setup");

    // Asserted on the CHILD rows, never on the parent. The first version
    // waited for "CLAUDE.md" — which is in the Repository Setup row's own
    // description — so it passed with the tree unexpanded and photographed
    // a caption about generators beside no generators at all. Green, and
    // false.
    await expect(window.locator('.monaco-list-row:has-text("Generate Agent Instructions")').first()).toBeVisible();
    // `setup-offers-only-what-applies` shows Dependabot where the origin is
    // GitHub or unknown. The fixture has no git remote — unknown, so shown.
    await expect(window.locator('.monaco-list-row:has-text("Configure Dependabot")').first()).toBeVisible();
    // The Copilot row is offered only where Copilot is present — the
    // extension, or a `copilot` CLI on the path. That is a fact about the
    // machine taking the picture, not about the fixture. Asserted, so that
    // regenerating on a machine without Copilot fails here rather than
    // quietly producing a picture its caption no longer describes.
    await expect(window.locator('.monaco-list-row:has-text("Generate Path-Scoped Copilot Instructions")').first()).toBeVisible();

    await settle(window);
    await shoot("repository-setup.png");
  });

  test("the archive context menu and what it offers", async () => {
    await closeEditors();
    await onlyExpand("Archive");
    await openContextMenu("2026-08-01-a-change-that-shipped");

    // The caption names four actions. A menu that opened but carries
    // different entries makes the caption false, so each is asserted
    // rather than the menu merely being visible.
    for (const action of ["Unarchive", "Rollback", "Delete"]) {
      await expect(window.locator(`.context-view .action-label:has-text("${action}")`).first()).toBeVisible();
    }

    await shoot("archive-actions.png");
  });

  test("an archived change's tasks, beside its context menu", async () => {
    await closeEditors();
    await onlyExpand("Archive");
    await expandRow("2026-08-01-a-change-that-shipped");
    await expandRow("Tasks");
    await expect(window.locator('.monaco-list-row:has-text("Done")').first()).toBeVisible();

    // The caption is "expanded archived change tasks BESIDE the archive
    // context menu" — both halves, so both are waited on.
    await openContextMenu("2026-08-01-a-change-that-shipped");
    await expect(window.locator(".context-view .action-label").first()).toBeVisible();

    await shoot("archive-tasks.png");
  });

  test("the template context menu and what it offers", async () => {
    await closeEditors();
    await onlyExpand("Templates");
    await expandRow("Built-in");
    await expandRow("auth");

    // The menu belongs to a TEMPLATE, not to the category above it —
    // right-clicking "auth" opens nothing, which is what the first
    // attempt timed out on. The row after the expanded category is the
    // first template in it, whatever the built-in catalogue calls it.
    const template = window.locator('.monaco-list-row[aria-level="3"]').first();
    await template.waitFor();
    await template.click({ button: "right" });
    await window.locator(".context-view .monaco-menu").first().waitFor();

    // The caption names two actions. Asserting only that a menu opened
    // would let a menu of different entries photograph under this caption.
    for (const action of ["Customize Template", "Insert Template Into"]) {
      await expect(window.locator(`.context-view .action-label:has-text("${action}")`).first()).toBeVisible();
    }

    await shoot("template-actions.png");
  });
});

/** Right-clicks a tree row and waits for the menu to be drawn.
 *
 * A context menu is the part of this most likely to move under an editor
 * version bump, so it is opened by the one gesture that raises it rather
 * than by a path through the menu bar. */
async function openContextMenu(label: string): Promise<void> {
  const row = window.locator(`.monaco-list-row:has-text("${label}")`).first();
  await row.waitFor();
  await row.click({ button: "right" });
  await window.locator(".context-view .monaco-menu").first().waitFor();
}

/** Dismisses a context menu a previous capture left open.
 *
 * An open menu covers the tree and swallows clicks, so the capture after
 * one that opened a menu times out on a row that is plainly there. The
 * failure names the row, not the menu, which is why this is worth doing
 * rather than debugging twice. */
async function dismissMenus(): Promise<void> {
  if (await window.locator(".context-view .monaco-menu").count() === 0) return;
  await window.keyboard.press("Escape");
  await expect(window.locator(".context-view .monaco-menu")).toHaveCount(0);
}

/** Closes whatever a previous capture left open.
 *
 * Without this a picture inherits the editor the test before it opened,
 * so what it shows depends on the order the tests ran in — and a picture
 * whose contents depend on test order is not evidence of anything. Found
 * by looking at `nested-tasks.png` and seeing a `spec.md` its caption
 * never mentions. */
async function closeEditors(): Promise<void> {
  await dismissMenus();
  if (await window.locator(".tabs-container .tab").count() === 0) return;
  // The editor's own "close all editors" chord, not a click on the tab's
  // close icon: that icon appears on hover, so clicking it is a race
  // that passes until it does not.
  await window.keyboard.press("Control+K");
  await window.keyboard.press("Control+W");
  await expect(window.locator(".tabs-container .tab")).toHaveCount(0);
}

/** Leaves exactly one pane expanded, so a picture of one view is not
 * also a picture of five others. */
async function onlyExpand(pane: string): Promise<void> {
  for (let guard = 12; guard > 0; guard -= 1) {
    const expanded = window.locator(".pane-header.expanded").first();
    if (await expanded.count() === 0) break;
    await expanded.click();
  }
  await window.locator(`.pane-header:has-text("${pane}")`).first().click();
  await expect(window.locator(`.pane-header.expanded:has-text("${pane}")`)).toHaveCount(1);
}

/** Expands a tree row by its label, and waits for the expansion to take
 * — clicking a twistie is instant and loading its children is not. */
async function expandRow(label: string): Promise<void> {
  const row = window.locator(`.monaco-list-row:has-text("${label}")`).first();
  await row.waitFor();
  if ((await row.getAttribute("aria-expanded")) === "false") {
    await row.locator(".monaco-tl-twistie").click();
  }
  await expect(row).toHaveAttribute("aria-expanded", "true");
}

/** The opposite of `expandRow`, for a row an earlier capture opened that
 * the next picture's caption says nothing about. */
async function collapseRow(label: string): Promise<void> {
  const row = window.locator(`.monaco-list-row:has-text("${label}")`).first();
  if (await row.count() === 0) return;
  if ((await row.getAttribute("aria-expanded")) === "true") {
    await row.locator(".monaco-tl-twistie").click();
  }
  await expect(row).not.toHaveAttribute("aria-expanded", "true");
}
