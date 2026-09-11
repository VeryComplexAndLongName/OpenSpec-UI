// Produces docs/images/standalone/change-charts.png from the real
// standalone app, and asserts the charts drew what the fixture's history
// says they should.
//
// The fixture is a git repository because the charts read one: the dates
// come from the commit that proposed each change and the one that
// archived it. A workspace without history carries no dates, and the
// charts correctly draw nothing — a fine test and a useless picture.
//
// See openspec/changes/charts-over-what-happened.

import { expect, test } from "@playwright/test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { createDatedWorkspace } from "./fixtures/create-dated-workspace.js";

const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "images", "standalone");

test.describe("standalone change charts", () => {
  let workspaceRoot: string;

  test.afterEach(async () => {
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
  });

  test("charts what the history says, and says what it rests on", async ({ page }) => {
    test.setTimeout(90000);
    // Two archived on one day, one on the next, one two days later — so
    // the bars have a shape and one quiet day sits between them.
    workspaceRoot = await createDatedWorkspace([
      { name: "first-change", proposedOn: "2026-03-01", archivedOn: "2026-03-02" },
      { name: "second-change", proposedOn: "2026-03-01", archivedOn: "2026-03-02" },
      { name: "third-change", proposedOn: "2026-03-02", archivedOn: "2026-03-03" },
      { name: "slow-change", proposedOn: "2026-03-01", archivedOn: "2026-03-05" },
      { name: "still-open", proposedOn: "2026-03-04" },
    ]);

    const server: OpenSpecUiServer = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
    const address = await server.listen();

    try {
      await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
      await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);

      await page.getByRole("tab", { name: "Timeline" }).click();
      await page.getByRole("button", { name: "Compare changes" }).click();
      await page.getByLabel("Timeline range start").fill("2026-03-01");
      await page.getByLabel("Timeline range end").fill("2026-03-06");
      await page.getByLabel("Changes to compare").selectOption([
        "archived:2026-03-02-first-change",
        "archived:2026-03-02-second-change",
        "archived:2026-03-03-third-change",
        "archived:2026-03-05-slow-change",
        "active:still-open",
      ]);
      await page.getByRole("button", { name: "Load comparison" }).click();

      await expect(page.getByTestId("change-charts")).toBeVisible({ timeout: 20000 });
      // Four days: two archived on the 2nd, one on the 3rd, none on the
      // 4th, one on the 5th. The quiet day is a bar of zero, not a
      // missing column.
      //
      // Asserted row by row, count included. Checking only that one date
      // appears passes a chart that drew every bar as zero, which is the
      // shape this test is named for — see
      // a-check-that-passes-checked-something.
      const perDay = page.getByTestId("chart-archived-per-day-table");
      const rows = perDay.locator("tbody tr");
      const expected: [string, string][] = [
        ["2026-03-02", "2"],
        ["2026-03-03", "1"],
        ["2026-03-04", "0"],
        ["2026-03-05", "1"],
      ];
      await expect(rows).toHaveCount(expected.length);
      for (const [index, [day, count]] of expected.entries()) {
        const cells = rows.nth(index).locator("td");
        await expect(cells.nth(0)).toHaveText(day);
        await expect(cells.nth(1)).toHaveText(count);
      }
      // What it rests on, in the chart: every one of these dates is a
      // commit, because this fixture has a history.
      await expect(page.getByTestId("chart-archived-per-day-basis")).toContainText("dated from a commit");

      // The chart that is not drawn explains itself with this
      // workspace's own figures. It used to be a constant sentence
      // reading "measured over this repository, 135 of 185 changes",
      // shown to every workspace — a fact about the repository that
      // wrote it, presented as a fact about yours. Five changes are
      // compared here and all five carry a finished task committed with
      // their proposal, so the span is zero for every one of them.
      // See a-date-is-one-day-in-every-source.
      const workNote = page.getByTestId("chart-work-duration-note");
      await expect(workNote).toContainText("5 of 5 changes have exactly zero days");
      await expect(workNote).not.toContainText("185");
      await expect(workNote).not.toContainText("this repository");

      // Scoped to the charts themselves: a full-page capture here is
      // mostly the range pickers and the lanes above them, which the
      // timeline's own image already shows.
      await page.getByTestId("change-charts").screenshot({ path: path.join(IMAGES_DIR, "change-charts.png") });
    } finally {
      await server.close();
    }
  });
});
