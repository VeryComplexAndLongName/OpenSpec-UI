// Produces docs/images/standalone/harness-*.png from the real standalone
// app, driven by the same Playwright machinery as the other e2e specs —
// see openspec/changes/agentic-harness-documentation/proposal.md: a
// screenshot generated from the running UI cannot silently disagree with
// it the way a manually-captured one already had (docs/images/standalone/
// harness-settings.png dated 2026-08-31 showed a settings screen that had
// stopped existing three commits earlier).
//
// Regenerate with (from packages/server): `npm run test:browser --
// harness-screenshots.spec.ts`. This spec's only product is the three
// PNGs below; it does not assert application behavior beyond what is
// needed to reach each screen.

import { expect, test } from "@playwright/test";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { createLifecycleWorkspace } from "./fixtures/create-lifecycle-workspace.js";
import { createFakeAgentRunner } from "./fixtures/fake-agent-runner.js";
import { interceptWebSocket } from "./fixtures/intercept-websocket.js";

const CHANGE_NAME = "harness-docs-fixture";
const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "images", "standalone");

test.describe("standalone harness screenshots", () => {
  let workspaceRoot: string;

  test.afterEach(async () => {
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
  });

  test("captures the global settings section, a per-change override, and a run paused at a checkpoint", async ({ page }) => {
    test.setTimeout(60000);
    workspaceRoot = await createLifecycleWorkspace(CHANGE_NAME);

    // Global default: an agent with both an effort and a budget mechanism
    // (claude-cli), so the settings view's effort/budget controls render
    // populated rather than empty — see HarnessSettingsView.tsx's
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

      // 1. Global settings section.
      await page.getByRole("tab", { name: "Harness Settings" }).click();
      await expect(page.getByTestId("harness-settings-view")).toBeVisible();
      await expect(page.getByLabel("propose agent")).toHaveValue("claude-cli", { timeout: 15000 });
      await expect(page.getByLabel("propose effort")).toHaveValue("high");
      // Full-page: the stage list plus autonomy/review-gate controls below
      // it are taller than one viewport, and a documentation screenshot
      // that only shows the top half would misrepresent the screen.
      await page.screenshot({ path: path.join(IMAGES_DIR, "harness-settings.png"), fullPage: true });

      // 2. Per-change override, loaded from the file written above.
      await page.getByTestId("change-override-name-input").fill(CHANGE_NAME);
      await page.getByRole("button", { name: "Load override" }).click();
      await expect(page.getByLabel("Change autonomy level")).toHaveValue("semi-autonomous", { timeout: 15000 });
      await expect(page.getByLabel("Change review gate mode")).toHaveValue("", { timeout: 15000 });
      // Scoped to the override section, not `fullPage`. A full-page
      // capture here contains the whole global section as well, so the
      // second image was a strict superset of the first — two
      // illustrations of the same screen presented as two different
      // things, and 2131 pixels tall for a reader who only needed the
      // half that differs.
      // `.last()` because the view nests one section inside another, so
      // the filter matches the outer wrapper as well; the inner one comes
      // second in DOM order and is the section this image is about.
      await page.locator("section", { has: page.getByRole("heading", { name: "Per-change override" }) })
        .last()
        .screenshot({ path: path.join(IMAGES_DIR, "harness-change-override.png") });

      // 3. A run in progress, paused at a checkpoint.
      await page.getByRole("tab", { name: "Change Editor" }).click();
      await page.locator("section", { has: page.getByRole("heading", { name: "Change Editor" }) })
        .getByRole("combobox")
        .selectOption(CHANGE_NAME);
      await page.getByRole("button", { name: "Load change", exact: true }).click();
      await expect(page.getByText(`Loaded ${CHANGE_NAME}.`)).toBeVisible({ timeout: 15000 });
      await page.getByTestId("run-with-harness-button").click();
      // "Run with Agentic Harness" only resolves which surface to dispatch
      // to (resolveRunWithHarnessDispatch) — a "semi-autonomous" change
      // resolves to HarnessChainPanel, which renders its own, second "Run
      // with Agentic Harness" button (start-chain-button) that must be
      // clicked to actually start the run.
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
