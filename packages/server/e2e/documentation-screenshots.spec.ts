// Produces the standalone pictures `packages/server/README.md` and the
// root `README.md` carry, from the running application — the same
// machinery `harness-screenshots.spec.ts` already uses for the harness
// ones.
//
// Until this spec they were taken by hand, most of them on 22 August,
// against a requirement (openspec/specs/openspec-workbench/spec.md) that
// has said since it was written that a documentation picture must be
// captured by a test: "a hand-taken screenshot goes stale silently: the
// screen changes, the picture does not, and nothing fails."
//
// Regenerate with (from packages/server):
// `npm run test:browser -- documentation-screenshots.spec.ts`.
//
// Every capture waits on the element that makes the picture worth having
// before it fires. That is not politeness about timing: it is what makes
// a changed screen fail here instead of producing a picture of the wrong
// thing. See every-screenshot-is-taken-by-a-spec.

import { expect, test } from "@playwright/test";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { createLifecycleWorkspace } from "./fixtures/create-lifecycle-workspace.js";
import { createFakeAgentRunner } from "./fixtures/fake-agent-runner.js";

const CHANGE_NAME = "documentation-fixture";
const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "images", "standalone");

test.describe("standalone documentation screenshots", () => {
  let workspaceRoot: string;

  test.afterEach(async () => {
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
  });

  test("captures the command runner, the summary, the diff, the editor, the templates and the processes", async ({ page }) => {
    test.setTimeout(120000);
    workspaceRoot = await createLifecycleWorkspace(CHANGE_NAME);
    // `openspec show --type change` refuses a proposal with no "What
    // Changes" section, and the command runner's picture is of a
    // *completed* command. The fixture carries the sections the real CLI
    // requires rather than the minimum the server needs.
    await writeFile(
      path.join(workspaceRoot, "openspec", "changes", CHANGE_NAME, "proposal.md"),
      [
        "## Why",
        "",
        "The documentation needs a change to photograph.",
        "",
        "## What Changes",
        "",
        "- Adds a capability the pictures can show.",
        "",
      ].join("\n"),
      "utf8",
    );
    // A tasks file with something done and something not: the editor's
    // picture is of a change being worked on, and an all-empty checklist
    // photographs as a screen nobody has used.
    await writeFile(
      path.join(workspaceRoot, "openspec", "changes", CHANGE_NAME, "tasks.md"),
      [
        "## 1. The work",
        "",
        "- [x] 1.1 Write the proposal.",
        "- [ ] 1.2 Implement it.",
        "- [ ] 1.3 Verify it.",
        "",
      ].join("\n"),
      "utf8",
    );

    const server: OpenSpecUiServer = createServer({
      workspaceRoot,
      host: "127.0.0.1",
      port: 0,
      runners: new Map([["claude-cli", createFakeAgentRunner({ changeName: CHANGE_NAME })]]),
    });
    const address = await server.listen();

    try {
      const pageErrors: Error[] = [];
      page.on("pageerror", (error) => pageErrors.push(error));

      await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
      await expect(page.getByRole("heading", { name: "OpenSpec UI", level: 1 })).toBeVisible();
      // Filling the workspace root auto-fills the change directory, which
      // is what enables the AI panel at all.
      await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);

      // 1. The command runner, with a completed command in it. A picture
      // of the empty form would show the controls and none of the point:
      // the structured result and the streamed output share the view.
      await page.getByTestId("load-changes-button").click();
      await expect(page.getByTestId("change-picker")).toContainText(CHANGE_NAME, { timeout: 20000 });
      await page.getByTestId("change-picker").selectOption(CHANGE_NAME);
      await page.getByTestId("command-picker").selectOption("show");
      await page.getByTestId("run-button").click();
      await expect(page.getByTestId("event-log")).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId("run-status-label")).toContainText("Completed", { timeout: 20000 });
      await page.locator("section", { has: page.getByRole("heading", { name: "Run a command" }) })
        .screenshot({ path: path.join(IMAGES_DIR, "run-command.png") });

      // 2. The summary. Loading it shells out to the `openspec` CLI, the
      // same call standalone.spec.ts waits 15s for on a loaded runner.
      await page.getByRole("tab", { name: "OpenSpec view summary" }).click();
      await page.getByRole("button", { name: "Load summary" }).click();
      await expect(page.getByTestId("openspec-overview")).toContainText(CHANGE_NAME, { timeout: 20000 });
      await page.locator("section", { has: page.getByRole("heading", { name: "OpenSpec view summary" }) })
        .screenshot({ path: path.join(IMAGES_DIR, "view-summary.png") });

      // 3. The diff preview. Its content is the panel's own fixture, so
      // this waits on the rendered diff rather than on a load.
      await page.getByRole("tab", { name: "Diff Preview" }).click();
      const diff = page.locator("section", { has: page.getByRole("heading", { name: "Diff preview" }) });
      await expect(diff).toContainText("task one", { timeout: 15000 });
      await diff.screenshot({ path: path.join(IMAGES_DIR, "diff-preview.png") });

      // 4. The editor, with a change loaded.
      await page.getByRole("tab", { name: "Change Editor" }).click();
      const editor = page.locator("section", { has: page.getByRole("heading", { name: "Change Editor" }) });
      await editor.getByRole("combobox", { name: "Change to edit" }).selectOption(CHANGE_NAME);
      await page.getByRole("button", { name: "Load change", exact: true }).click();
      await expect(page.getByText(`Loaded ${CHANGE_NAME}.`)).toBeVisible({ timeout: 20000 });
      await expect(page.getByLabel("Markdown (proposal)")).toBeVisible();
      await editor.screenshot({ path: path.join(IMAGES_DIR, "change-editor.png") });

      // 5. The entry into a harness run, for the change loaded above.
      // Scoped to the control row: the editor around it is already its
      // own picture, and README's caption is about this one control.
      await expect(page.getByTestId("run-with-harness-button")).toBeVisible();
      await page.locator("div", { has: page.getByTestId("run-with-harness-button") })
        .last()
        .screenshot({ path: path.join(IMAGES_DIR, "run-with-harness.png") });

      // 6. The template catalog.
      await page.getByRole("tab", { name: "Templates" }).click();
      await page.getByRole("button", { name: "Load templates" }).click();
      await expect(page.getByTestId("templates-table")).toBeVisible({ timeout: 20000 });
      await page.locator("section", { has: page.getByRole("heading", { name: "Templates" }) })
        .screenshot({ path: path.join(IMAGES_DIR, "templates.png"), timeout: 20000 });

      // 7. Processes and recovery, after a run that was journaled. The
      // `implement` run is what puts a row in it; a picture of the view
      // with nothing in it would show the headings and no record.
      await page.getByRole("tab", { name: "Run a Command" }).click();
      await page.getByTestId("command-picker").selectOption("implement");
      await page.getByTestId("run-button").click();
      await expect(page.getByTestId("run-status-label")).toContainText("Completed", { timeout: 20000 });
      await page.getByRole("tab", { name: "Processes and Recovery" }).click();
      const processes = page.locator("section", { has: page.getByRole("heading", { name: "Processes and recovery" }) });
      await expect(processes).toContainText(CHANGE_NAME, { timeout: 20000 });
      await processes.screenshot({ path: path.join(IMAGES_DIR, "processes.png") });

      expect(pageErrors).toEqual([]);
    } finally {
      await server.close();
    }
  });
});
