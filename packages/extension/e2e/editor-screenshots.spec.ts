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
  // A reader sees the editor they have installed, not the one this
  // repository downloaded for its integration suite, and the two differ
  // in how they draw a view's title. `OPENSPEC_PICTURE_EDITOR` names the
  // binary to photograph with (the-pictures-show-what-is-drawn-now).
  const named = process.env.OPENSPEC_PICTURE_EDITOR;
  if (named !== undefined && named.trim().length > 0) return named;
  // Both places the download lands: the repository root, and the package
  // the integration suite is configured from. Which one it is depends on
  // where that suite was last run from, and a capture that knows only one
  // of them fails with the editor sitting in the other
  // (the-icon-carries-the-colour).
  const { readdir } = await import("node:fs/promises");
  const roots = [
    path.resolve(HERE, "..", "..", "..", ".vscode-test"),
    path.resolve(HERE, "..", ".vscode-test"),
  ];
  for (const testRoot of roots) {
    let entries;
    try {
      entries = await readdir(testRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    const archive = entries.find((entry) => entry.isDirectory() && entry.name.startsWith("vscode-"));
    if (archive) return path.join(testRoot, archive.name, "Code.exe");
  }
  throw new Error(
    `no VS Code under ${roots.join(" or ")}. Run the extension's integration suite once to download it.`,
  );
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
 * disappear. The first capture carried a floating "OpenSpec Workbench" label
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
    // Wide enough that no row is cut off. At the side bar's default
    // width a change's state, its standing word and a dated archive
    // folder all end in an ellipsis, and the picture the README leads
    // with showed a product that cannot say what it knows
    // (the-pictures-show-what-is-drawn-now).
    await widenSideBar(560);
    // Taller than the rest, because the caption promises every view and
    // the seventh - the Human-Only Inbox - fell below a 900 pixel window
    // once the Changes view learned to say what the sweep cleared.
    await window.setViewportSize({ width: 1440, height: 1200 });
    // What the README leads with: every view the extension contributes,
    // each with something in it, and each row readable.
    //
    // Every assertion below is `toBeInViewport`, not `toBeVisible`: a row
    // below a pane's fold, and a pane below the window, are both "visible"
    // to a locator, and that is how the seventh view and half the words
    // went missing from the picture that promises them
    // (the-pictures-show-what-is-drawn-now).
    for (const pane of ["Changes", "Archive", "Specs", "Processes", "Templates", "Change Graph", "Human-Only Inbox"]) {
      await expect(window.locator(`.pane-header:has-text("${pane}")`).first()).toBeInViewport();
    }
    // What each view has in it, in the words the caption uses.
    await expect(window.locator('.monaco-list-row:has-text("Cleared 1 directory")').first()).toBeInViewport();
    await expect(window.locator('.monaco-list-row:has-text("a-change-in-progress")').first())
      .toContainText("Blocked by a-change-not-started");
    await expect(window.locator('.monaco-list-row:has-text("2026-08-01-a-change-that-shipped")').first())
      .toContainText("archived");
    await expect(window.locator('.monaco-list-row:has-text("a-capability")').first()).toContainText("1 requirement");
    await expect(window.locator('.monaco-list-row:has-text("1 landed relation hidden")').first()).toBeInViewport();
    await expect(window.locator('.monaco-list-row:has-text("Whether the picture reads")').first()).toBeInViewport();

    await settle(window);
    await shoot("overview-expanded.png");
    await window.setViewportSize({ width: 1440, height: 900 });
  });

  test("the workbench, compact", async () => {
    await closeEditors();
    await widenSideBar(560);
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

  test("the global harness settings, in a panel of their own", async () => {
    await closeEditors();
    await runCommand("OpenSpec Workbench: Configure Harness Settings");

    // The panel's title is the editor's, the form is the webview's. A
    // picture taken on the title alone shows a panel reading nothing, which
    // is the defect a-change-is-configured-from-the-change fixed.
    await expect(window.locator('.tabs-container .tab:has-text("OpenSpec Workbench: Harness Settings")')).toBeVisible();
    const view = activeWebview();
    await expect(view.getByTestId("global-harness-settings")).toBeVisible({ timeout: 60_000 });
    await expect(view.getByLabel("Global autonomy level")).toBeVisible({ timeout: 30_000 });
    await expect(view.getByTestId("global-harness-named-configuration-description")).toBeVisible();

    await settle(window);
    await shoot("harness-settings.png");
  });

  test("one change's harness settings, opened from the change", async () => {
    await closeEditors();
    await onlyExpand("Changes");
    await openContextMenu("a-change-in-progress");
    // Hovered and chosen with Enter, not clicked: a click on the label
    // left the menu open and ran nothing, where a hover focuses the item
    // the way a person's pointer does.
    const item = window.getByRole("menuitem", { name: "OpenSpec Workbench: Configure Harness for this Change" });
    await item.hover();
    await window.keyboard.press("Enter");

    await expect(window.locator('.tabs-container .tab:has-text("Harness: a-change-in-progress")')).toBeVisible();
    const view = activeWebview();
    // Waited for on what the change's file loaded into, not on the panel:
    // the name must already be in the page, with nothing typed.
    await expect(view.getByTestId("change-harness-settings")).toBeVisible({ timeout: 60_000 });
    await expect(view.getByLabel("Change autonomy level")).toBeVisible({ timeout: 30_000 });
    await expect(view.getByLabel("change propose agent").locator("option").first()).toContainText("(inherit:");
    await expect(view.getByTestId("change-harness-named-configuration-description")).toBeVisible();

    await settle(window);
    await shoot("harness-change.png");
  });

  test("the Changes tree, each change with the word for where it stands", async () => {
    await closeEditors();
    await onlyExpand("Changes");
    await collapseRow("a-change-in-progress");
    await collapseRow("Repository Setup");

    // the-docs-catch-up-to-0-55 1.3. The caption claims a word beside
    // EACH change, and a tree that has not read its standings yet lists
    // the same rows without one. So every row is waited on for the dash
    // that joins its state to its word, never on the row alone.
    for (const change of ["a-change-in-progress", "a-change-not-started"]) {
      const row = window.locator(`.monaco-list-row:has-text("${change}")`).first();
      await expect(row.locator(".label-description")).toContainText(" — ", { timeout: 120_000 });
    }

    // The first capture cut the first row's word to "Re…": the side bar's
    // default width holds the name and state but not the word. Its text was
    // whole, so no text assertion could see it. The side bar is widened by
    // its own sash, and each row's label is asserted to fit.
    await widenSideBar(560);
    for (const change of ["a-change-in-progress", "a-change-not-started"]) {
      const label = window.locator(`.monaco-list-row:has-text("${change}") .monaco-icon-label-container`).first();
      await expect.poll(() => label.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }

    await settle(window);
    await shoot("changes-standings.png");
  });

  test("the Pipeline, in a panel of the editor", async () => {
    await closeEditors();
    await runCommand("OpenSpec Workbench: Open Pipeline");

    // the-docs-catch-up-to-0-55 1.2. Waited for on the fixture's cards in
    // the webview, not on the panel's title: a panel that opened and has
    // not read the changes yet photographs as a Pipeline with nothing in
    // it.
    const view = activeWebview();
    await expect(view.getByTestId("pipeline-node-a-change-in-progress")).toBeVisible({ timeout: 120_000 });
    await expect(view.getByTestId("pipeline-node-a-change-not-started")).toBeVisible();

    await settle(window);
    await shoot("pipeline-panel.png");
  });

  // What the views learned after these pictures were last taken
  // (the-pictures-show-what-is-drawn-now): a filter, a fold, a relation
  // stated from a row, and what the sweep cleared.

  test("the Archive view narrowed by a filter, saying what it is showing", async () => {
    await closeEditors();
    await onlyExpand("Archive");
    await runCommand("OpenSpec Workbench: Filter Archive", "Every word must appear somewhere in the row");
    const input = window.locator(".quick-input-widget input");
    await input.waitFor();
    await input.fill("shipped");
    await window.keyboard.press("Enter");
    await expect(window.locator(".quick-input-widget")).toBeHidden();

    // The message is the part of this picture a reader cannot guess, so
    // the capture waits on the message and not on the rows.
    const archive = window.locator('.pane:has(.pane-header:has-text("Archive"))').first();
    await expect(archive).toContainText('Filtered by "shipped" - showing 1 of 3', { timeout: 60_000 });

    await settle(window);
    await shoot("archive-filtered.png");

    await runCommand("OpenSpec Workbench: Clear Archive Filter");
    await expect(archive).not.toContainText("Filtered by");
  });

  test("the Change Graph with its landed branches folded", async () => {
    await closeEditors();
    await onlyExpand("Change Graph");

    const graph = window.locator('.pane:has(.pane-header:has-text("Change Graph"))').first();
    // Both halves of what this picture is of: the live relation it keeps
    // drawing, and the finished branch it folded away with its count.
    await expect(graph).toContainText("waiting on a-change-not-started", { timeout: 120_000 });
    await expect(graph).toContainText("1 landed relation hidden");

    await settle(window);
    await shoot("change-graph-folded.png");
  });

  test("a relation being stated from a change's row", async () => {
    await closeEditors();
    await onlyExpand("Changes");
    const row = window.locator('.monaco-list-row:has-text("a-change-in-progress")').first();
    await row.scrollIntoViewIfNeeded();
    await row.click();

    // Left open on purpose: this picture is of the question, so the
    // command runs and the pick is photographed rather than answered.
    await window.keyboard.press("F1");
    const input = window.locator(".quick-input-widget input");
    await input.waitFor();
    await input.fill(">OpenSpec Workbench: Add Relation");
    await window.locator('.quick-input-list .monaco-list-row:has-text("OpenSpec Workbench: Add Relation")').first().waitFor();
    await window.keyboard.press("Enter");

    const pick = window.locator(".quick-input-widget");
    await expect(pick).toContainText("Relation to state on a-change-in-progress", { timeout: 60_000 });
    await expect(pick).toContainText("Blocked by");
    await expect(pick).toContainText("This change waits on another");

    // `settle` moves the pointer; the pick stays open because nothing
    // takes the focus from it.
    await settle(window);
    await shoot("relation-pick.png");

    await window.keyboard.press("Escape");
    await expect(pick).toBeHidden();
  });

  test("the Changes view saying what the sweep cleared", async () => {
    await closeEditors();
    await onlyExpand("Changes");

    const changes = window.locator('.pane:has(.pane-header:has-text("Changes"))').first();
    // The sweep runs on activation. Both rows are the picture: what went,
    // and what stayed because nothing of its name is archived.
    await expect(changes).toContainText("Cleared 1 directory the archive left behind", { timeout: 120_000 });
    await expect(changes).toContainText("an-idea-not-written-yet");

    await settle(window);
    await shoot("leftovers-cleared.png");
  });
});

/** Scrolls a pane's list until a row is drawn.
 *
 * A tree view renders only the rows that fit, so a row below the fold is
 * absent rather than merely out of sight, and `scrollIntoViewIfNeeded`
 * has nothing to scroll to. The wheel is what a reader would use. */
async function scrollPaneTo(pane: string, selector: string): Promise<void> {
  const body = window.locator(`.pane:has(.pane-header:has-text("${pane}")) .pane-body`).first();
  const box = await body.boundingBox();
  if (!box) throw new Error(`the ${pane} pane is not drawn`);
  await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let remaining = 12; remaining > 0; remaining -= 1) {
    if (await window.locator(selector).count() > 0) return;
    await window.mouse.wheel(0, 60);
    await window.waitForTimeout(150);
  }
  await expect(window.locator(selector).first()).toBeVisible();
}

/** Drags the side bar's sash until the side bar is `width` pixels wide,
 * the way a person widens it. There is no setting for its width. */
async function widenSideBar(width: number): Promise<void> {
  const sideBar = window.locator(".part.sidebar");
  const box = await sideBar.boundingBox();
  if (!box) throw new Error("the side bar is not drawn");
  const y = box.y + box.height / 2;
  await window.mouse.move(box.x + box.width - 1, y);
  await window.mouse.down();
  await window.mouse.move(box.x + width, y, { steps: 10 });
  await window.mouse.up();
  await expect.poll(async () => (await sideBar.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(width - 8);
}

/** Runs a command by its title through the command palette, the way a
 * reader of the caption would.
 *
 * `thenAsking` is the text the command's own input box carries, for a
 * command that opens one. Waiting for the widget to hide is wrong for
 * those: the palette closes and the command's box opens into the same
 * widget, so whether a gap ever appears is a race this lost twice in a
 * row (the-icon-carries-the-colour). */
async function runCommand(title: string, thenAsking?: string): Promise<void> {
  await window.keyboard.press("F1");
  const input = window.locator(".quick-input-widget input");
  await input.waitFor();
  await input.fill(`>${title}`);
  await window.locator(`.quick-input-list .monaco-list-row:has-text("${title}")`).first().waitFor();
  await window.keyboard.press("Enter");
  if (thenAsking !== undefined) {
    await expect(window.locator(".quick-input-widget")).toContainText(thenAsking);
    return;
  }
  await expect(window.locator(".quick-input-widget")).toBeHidden();
}

/** The page inside the webview the editor is showing. VS Code puts a
 * webview's page in a frame inside its own frame, and keeps a hidden one
 * for every panel that is not in front. */
function activeWebview() {
  return window.frameLocator("iframe.webview.ready").last().frameLocator("#active-frame");
}

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
  //
  // The tab is clicked first. A webview panel keeps the keyboard inside
  // its own frame, where the chord never reaches the editor, and the
  // capture after a harness panel's timed out on a tab that stayed open.
  // Retried as a whole, because the webview can take the focus back as
  // the click activates it.
  await expect(async () => {
    await window.locator(".tabs-container .tab").first().click();
    await window.keyboard.press("Control+K");
    await window.keyboard.press("Control+W");
    await expect(window.locator(".tabs-container .tab")).toHaveCount(0, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
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
