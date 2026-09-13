// Produces docs/images/standalone/harness-*.png and run-dialog.png from the
// real standalone app, driven by the same Playwright machinery as the other
// e2e specs — see openspec/changes/agentic-harness-documentation/proposal.md:
// a screenshot generated from the running UI cannot silently disagree with
// it the way a manually-captured one already had (docs/images/standalone/
// harness-settings.png dated 2026-08-31 showed a settings screen that had
// stopped existing three commits earlier).
//
// Regenerate with (from packages/server): `npm run test:browser --
// harness-screenshots.spec.ts`. Beyond the pictures, it measures one thing
// the pictures are about: that a settings view's sections are told apart
// by more space than separates the fields inside one
// (a-change-is-configured-from-the-change).

import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { createLifecycleWorkspace } from "./fixtures/create-lifecycle-workspace.js";
import { createFakeAgentRunner } from "./fixtures/fake-agent-runner.js";
import { interceptWebSocket } from "./fixtures/intercept-websocket.js";

const CHANGE_NAME = "harness-docs-fixture";
const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "images", "standalone");

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error("an element measured for spacing is not rendered");
  return found;
}

/** Applies the selected named configuration, then compares the space
 * between the picker's status line and the first stage row with the space
 * between two stage rows. The applied values are not saved and are not
 * what any picture shows: the pictures are taken before this runs. */
async function expectSectionsSetApart(page: Page, prefix: string, fields: string): Promise<void> {
  await page.getByTestId(`${prefix}-named-configuration-apply`).click();
  const status = page.getByTestId(`${prefix}-named-configuration-status`);
  await expect(status).toBeVisible();
  const rows = page.getByTestId(fields).locator(".openspec-harness-stage-row");
  const statusBox = await box(status);
  const first = await box(rows.nth(0));
  const second = await box(rows.nth(1));
  const betweenSections = first.y - (statusBox.y + statusBox.height);
  const betweenFields = second.y - (first.y + first.height);
  expect(betweenSections).toBeGreaterThan(betweenFields);
}

test.describe("standalone harness screenshots", () => {
  let workspaceRoot: string;

  test.afterEach(async () => {
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  test("captures the global settings, a change's own settings, the run dialog, and a run paused at a checkpoint", async ({ page }) => {
    test.setTimeout(90000);
    workspaceRoot = await createLifecycleWorkspace(CHANGE_NAME);

    // Global default: an agent with both an effort and a budget mechanism
    // (claude-cli), so the settings view's effort/budget controls render
    // populated rather than empty — see harness-settings-parts.tsx's
    // EffortSelect/BudgetInput, which only render once an agent that
    // accepts them is selected.
    await writeFile(
      path.join(workspaceRoot, "openspec", "agent-harness.json"),
      `${JSON.stringify({
        stepAgents: { propose: { agent: "claude-cli", effort: "high", budget: { maxCostUsd: 5 } } },
        autonomyLevel: "assisted",
      }, null, 2)}\n`,
      "utf8",
    );
    // A custom agent definition, so the per-stage picker renders with
    // something in it rather than with its "this workspace defines none"
    // note. It is the same file `claude --agent` itself reads, written
    // where that CLI reads it. See custom-agent-picker.
    await mkdir(path.join(workspaceRoot, ".claude", "agents"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, ".claude", "agents", "spec-reviewer.md"),
      ["---", "description: Reviews a change against its spec", "---", "", "Body.", ""].join("\n"),
      "utf8",
    );
    // Per-change override: semi-autonomous, so "Run with Agentic Harness"
    // dispatches to HarnessChainPanel (chain view) instead of the
    // single-stage picker, and a checkpoint pause becomes reachable.
    await writeFile(
      path.join(workspaceRoot, "openspec", "changes", CHANGE_NAME, "harness.json"),
      `${JSON.stringify({
        autonomyLevel: "semi-autonomous",
        stepAgents: { apply: "claude-cli", verify: "claude-cli" },
      }, null, 2)}\n`,
      "utf8",
    );

    const server: OpenSpecUiServer = createServer({
      workspaceRoot,
      host: "127.0.0.1",
      port: 0,
      runners: new Map([["claude-cli", createFakeAgentRunner({ changeName: CHANGE_NAME })]]),
    });
    const address = await server.listen();
    // The chain left running at a checkpoint keeps the page's WebSocket
    // open — `server.close()` waits for every connected client to
    // disconnect first, so the client side must be closed explicitly (see
    // intercept-websocket.ts's own header comment for why
    // `closeAllConnections()` alone does not do this).
    const socket = await interceptWebSocket(page);

    try {
      const pageErrors: Error[] = [];
      page.on("pageerror", (error) => pageErrors.push(error));

      await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
      await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);

      // 1. The global settings, and nothing about any one change.
      await page.getByRole("tab", { name: "Harness Settings" }).click();
      await expect(page.getByTestId("global-harness-settings")).toBeVisible();
      await expect(page.getByLabel("propose agent")).toHaveValue("claude-cli", { timeout: 15000 });
      await expect(page.getByLabel("propose effort")).toHaveValue("high");
      // Waited for before capturing: the definitions arrive over their
      // own route, and a screenshot taken first would show the picker's
      // "this workspace defines none" note instead of the picker.
      await expect(page.getByLabel("propose custom agent")).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("global-harness-named-configuration-description")).toBeVisible();
      await expect(page.getByTestId("harness-settings-change-pointer")).toBeVisible();
      // Full-page: the stage list plus autonomy/review-gate controls below
      // it are taller than one viewport, and a documentation screenshot
      // that only shows the top half would misrepresent the screen.
      await page.screenshot({ path: path.join(IMAGES_DIR, "harness-settings.png"), fullPage: true });
      await expectSectionsSetApart(page, "global-harness", "global-harness-fields");

      // 2. The change's own settings, in the Change Editor, where the
      // change is. Loaded from the file written above, with no name typed.
      await page.getByRole("tab", { name: "Change Editor" }).click();
      await page.locator("section", { has: page.getByRole("heading", { name: "Change Editor" }) })
        .getByRole("combobox")
        .first()
        .selectOption(CHANGE_NAME);
      await page.getByRole("button", { name: "Load change", exact: true }).click();
      await expect(page.getByText(`Loaded ${CHANGE_NAME}.`)).toBeVisible({ timeout: 15000 });
      await page.getByTestId("change-editor-tab-harness").click();
      await expect(page.getByTestId("change-harness-settings")).toBeVisible();
      await expect(page.getByLabel("Change autonomy level")).toHaveValue("semi-autonomous", { timeout: 15000 });
      await expect(page.getByLabel("Change review gate mode")).toHaveValue("");
      // The inherit option names what it resolves to. A picture of
      // "(inherit)" with no value is the screen this change replaced.
      await expect(page.getByLabel("change propose agent").locator("option").first())
        .toHaveText("(inherit: claude-cli, from the global file)");
      await expect(page.getByTestId("change-harness-named-configuration-description")).toBeVisible();
      // Scoped to the view, not `fullPage`: the rest of the Change Editor
      // is its own picture, and a capture containing both makes the reader
      // hunt for the half this one is about.
      await page.getByTestId("change-harness-settings")
        .screenshot({ path: path.join(IMAGES_DIR, "harness-change-override.png") });
      await expectSectionsSetApart(page, "change-harness", "change-harness-fields");

      // 3. The run dialog, with its named configurations in one list. The
      // markdown tab first, so the settings form applied above (and never
      // saved) is out of the checkpoint picture.
      await page.getByRole("button", { name: "proposal", exact: true }).click();
      await page.getByTestId("run-with-harness-button").click();
      // The entry shows what the configuration resolved to before acting
      // on it (one-way-in-to-run). It used to dispatch immediately, which
      // is why a correct decision and a broken one looked the same. This
      // change is "semi-autonomous", so the configured path is the chain.
      await expect(page.getByTestId("run-dialog")).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("run-dialog-because")).toContainText("semi-autonomous");
      // Waited for before capturing: the stage list is what makes the
      // picture worth having, and a screenshot taken before it renders
      // would show the dialog mid-mount.
      await expect(page.getByTestId("run-dialog-stage-agents")).toBeVisible();
      await expect(page.getByTestId("run-dialog-named-configuration-select")).toBeVisible();
      await page.getByTestId("run-dialog")
        .screenshot({ path: path.join(IMAGES_DIR, "run-dialog.png") });
      await page.getByTestId("run-dialog-path-chain").click();
      // Choosing the path reveals HarnessChainPanel, which has its own
      // "Start chain" button that must be clicked to actually start the
      // run.
      await page.getByTestId("start-chain-button").click();
      await expect(page.getByTestId("checkpoint-confirmation")).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: path.join(IMAGES_DIR, "harness-checkpoint.png") });

      expect(pageErrors).toEqual([]);
    } finally {
      await socket.current?.close();
      await server.close();
    }
  });
});
