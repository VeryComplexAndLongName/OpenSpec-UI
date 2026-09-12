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
  if (workspace) await rm(workspace.holder, { recursive: true, force: true });
});

/** Removes the chrome a documentation picture should not carry: the
 * toasts a development host raises about disabled extensions, and the
 * side bar the editor opens on its own. */
/** Takes the pointer out of the picture and lets any tooltip it raised
 * disappear. The first capture carried a floating "OpenSpec UI" label
 * over the Archive view — the tooltip from the click that opened the
 * container, photographed because nothing had moved the mouse away. */
async function settle(page: Page): Promise<void> {
  await page.mouse.move(720, 450);
  await expect(page.locator(".monaco-hover:visible")).toHaveCount(0);
}

async function quietTheEditor(page: Page): Promise<void> {
  for (const close of await page.locator(".notifications-toasts .codicon-notifications-clear").all()) {
    await close.click().catch(() => undefined);
  }
  await page.locator(".part.auxiliarybar .codicon-close").first().click().catch(() => undefined);
  await expect(page.locator(".notifications-toasts .notification-toast")).toHaveCount(0);
}

test.describe("editor documentation screenshots", () => {
  test("the workbench, expanded", async () => {
    // What the README leads with: every view the extension contributes,
    // each with something in it.
    const changes = window.locator('.monaco-list-row:has-text("a-change-in-progress")').first();
    await expect(changes).toBeVisible();
    await expect(window.locator('.monaco-list-row:has-text("a-capability")').first()).toBeVisible();

    await settle(window);
    await window.screenshot({ path: path.join(IMAGES, "overview-expanded.png") });
  });

  test("the workbench, compact", async () => {
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
    await window.screenshot({ path: path.join(IMAGES, "overview-compact.png") });
  });
});
