// A scheduled run starts when its time comes, and reports lateness when
// the time passed with nothing open.
//
// This is the human-only item of `a-run-can-be-scheduled` done by
// machine. It began as a hand-written spec that waited out both cases in
// real time: 90 seconds to the scheduled minute, then up to 150 more for
// it to fire, then 100 with the page closed — 340 seconds against a
// 300-second test budget, so it failed on the clock rather than on the
// behaviour, and took 5.2 minutes doing it.
//
// The second case does not need waiting at all. "The application was
// closed when the time came" is indistinguishable, to everything under
// test, from "an entry with a past time is in the file at load" — and
// the route that keeps the schedule can write exactly that. Only the
// first case still waits, because the firing tick is a minute and the
// point is that it fires by itself.
//
// See openspec/changes/a-run-can-be-scheduled.

import { expect, test, type Page } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer, type OpenSpecUiServer } from "../src/server.js";

const CHANGE_NAME = "scheduled-demo";

let server: OpenSpecUiServer;
let workspaceRoot: string;
let baseUrl: string;

test.beforeAll(async () => {
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-scheduled-"));
  const changeRoot = path.join(workspaceRoot, "openspec", "changes", CHANGE_NAME);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  await writeFile(path.join(changeRoot, "proposal.md"), "## Why\n\nScheduled smoke test.\n", "utf8");
  await writeFile(path.join(changeRoot, "tasks.md"), "## Tasks\n\n- [ ] 1.1 Wait.\n", "utf8");
  server = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await server?.close();
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
});

async function openShell(page: Page): Promise<void> {
  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
  await page.getByRole("tab", { name: "OpenSpec view summary" }).click();
  await page.getByRole("button", { name: "Load summary" }).click();
  await expect(page.getByTestId("openspec-overview")).toContainText(CHANGE_NAME, { timeout: 15000 });
}

async function openRunDialog(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Change Editor" }).click();
  await page.getByLabel("Change to edit").selectOption(CHANGE_NAME);
  await page.getByTestId("run-with-harness-button").click();
  await expect(page.getByTestId("run-dialog")).toBeVisible({ timeout: 15000 });
}

/** The start of a minute at least `atLeastSeconds` away, as a
 * `datetime-local` value in this machine's clock.
 *
 * Rounded up, never down. A `datetime-local` value carries no seconds,
 * so "now plus forty seconds" truncates into the current minute for
 * anyone who runs it after the half-minute — and the dialog then
 * refuses it, correctly, as a time already past. The first version of
 * this test did that and passed once by luck. */
function nextMinuteAtLeast(atLeastSeconds: number): string {
  const at = new Date(Date.now() + atLeastSeconds * 1000);
  at.setSeconds(0, 0);
  at.setMinutes(at.getMinutes() + 1);
  const local = new Date(at.getTime() - at.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

test.describe("a scheduled run", () => {
  test("starts by itself when its time comes", async ({ page }) => {
    // The tick is a minute, and that it fires unattended is the point,
    // so this one really waits. Everything else here does not.
    // Up to a minute to the scheduled boundary, then up to a minute for
    // the tick that fires it, and headroom for a loaded machine.
    test.setTimeout(300_000);
    await openShell(page);
    await openRunDialog(page);

    await page.getByLabel("Start at").fill(nextMinuteAtLeast(20));
    await page.getByTestId("run-dialog-schedule-single-stage").click();
    await expect(page.getByText(new RegExp(`Scheduled ${CHANGE_NAME} for`))).toBeVisible();

    // The dialog closed when it was scheduled; it comes back on its own.
    await expect(page.getByTestId("run-dialog-note")).toBeVisible({ timeout: 200_000 });
    await expect(page.getByTestId("run-dialog-note")).toContainText("Scheduled for");
  });

  test("reports how late it is when the time passed with nothing open", async ({ page, request }) => {
    // No waiting for a clock here, but the default 30s budget is still
    // less than the visibility timeout below, and the shorter one wins.
    test.setTimeout(120_000);
    // Written straight into the schedule with a time three hours gone:
    // to everything under test that is what a closed application leaves
    // behind, and waiting three hours to prove it would be a test nobody
    // runs.
    const response = await request.post(`${baseUrl}/api/scheduled-runs`, {
      headers: { "x-openspec-ui-token": server.accessToken },
      data: {
        cwd: workspaceRoot,
        add: {
          changeName: CHANGE_NAME,
          path: "single-stage",
          startAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          requestedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        },
      },
    });
    expect(response.ok()).toBe(true);

    // Deliberately not `openShell`: that helper clicks through to the
    // summary tab, and this run fires the moment the workspace is known
    // — switching to the change editor, where the dialog lives, before
    // the click lands. The first version of this test waited 120 seconds
    // for a button the feature had correctly taken away.
    //
    // Filling the workspace root is the whole interaction: leaving the
    // field loads the overview, and the schedule is read once the
    // changes are known.
    await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
    await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
    await page.getByLabel("Workspace root (cwd)").blur();

    await expect(page.getByTestId("run-dialog-note")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("run-dialog-note")).toContainText("hours late");
  });
});
