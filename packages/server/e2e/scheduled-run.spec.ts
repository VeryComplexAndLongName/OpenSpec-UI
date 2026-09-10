// A scheduled run starts when its time comes, and starts on the path it
// was given when the time passed with nothing open.
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
// Both cases were passing for reasons their names did not state. The
// second filled and blurred the workspace-root field, which is what
// loaded the overview and thus what let the schedule be read at all — a
// real reopen does neither, and the run did not start. Both asserted
// only that a note appeared, while the path the person had chosen was
// stored and never read. Corrected by a-schedule-keeps-its-promise:
// this file now opens the page and nothing else, and asserts the run
// itself started on the scheduled path.
//
// See openspec/changes/a-schedule-keeps-its-promise.

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

/** Opens the page and waits for the workspace to be known.
 *
 * Nothing is filled in and nothing is clicked: the root comes from the
 * server and the overview is read as soon as it is known. That is the
 * whole promise the dialog makes, so a helper that reached the same
 * state by any other route would be testing a different thing. */
async function openShell(page: Page): Promise<void> {
  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await expect(page.getByLabel("Workspace root (cwd)")).toHaveValue(workspaceRoot, { timeout: 20_000 });
}

async function openRunDialog(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Change Editor" }).click();
  await page.getByLabel("Change to edit").selectOption(CHANGE_NAME);
  await page.getByTestId("run-with-harness-button").click();
  await expect(page.getByTestId("run-dialog")).toBeVisible({ timeout: 15000 });
}

/** The "Run a Command" tab, pointed at the change that was scheduled.
 *
 * This is what `single-stage` starting looks like from outside: the run
 * surface is on screen and its change directory is the scheduled
 * change's. A `chain` would have mounted the chain panel in the change
 * editor instead, so the assertion distinguishes the two paths rather
 * than merely observing that something happened. */
async function expectSingleStageStarted(page: Page): Promise<void> {
  await expect(page.getByLabel("Change directory")).toHaveValue(
    new RegExp(`${CHANGE_NAME}$`),
    { timeout: 15_000 },
  );
  await expect(page.getByTestId("run-dialog")).toHaveCount(0);
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
  test("starts by itself when its time comes, on the path it was given", async ({ page }) => {
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

    // What the schedule did, in the region every tab shows.
    await expect(page.getByTestId("schedule-status")).toContainText("Scheduled for", { timeout: 200_000 });
    // And the run itself, on `single-stage` because that is the button
    // that was pressed — not a dialog waiting for the choice to be made
    // a second time.
    await expectSingleStageStarted(page);

    // A lateness note belongs to the run it explained. Opening the
    // dialog by hand afterwards must not inherit it, or it would say a
    // schedule started something nobody scheduled.
    await openRunDialog(page);
    await expect(page.getByTestId("run-dialog-note")).toHaveCount(0);
  });

  test("starts on reopening alone when the time passed with nothing open", async ({ page, request }) => {
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

    // Navigating is the whole interaction. The previous version filled
    // and blurred the workspace-root field, and that blur was what
    // loaded the overview — so the test passed while a real reopen,
    // which does neither, started nothing at all.
    await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);

    await expect(page.getByTestId("schedule-status")).toContainText("hours late", { timeout: 90_000 });
    await expectSingleStageStarted(page);
  });
});
