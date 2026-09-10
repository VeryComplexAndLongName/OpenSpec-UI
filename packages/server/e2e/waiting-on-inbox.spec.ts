// The shell's block of what is waiting, and who on.
//
// `standalone-entry.tsx` has no unit test — it is a large component the
// browser suite covers, and this is where its rendering is asserted. The
// sentence and the per-row label come from core's `describeWaitingOn`
// and `describeHumanOnlyInbox`, both unit-tested there; what this asserts
// is that the shell reaches them with the right items and shows both
// kinds apart.
//
// Its own workspace rather than `standalone.spec.ts`'s: that file's
// single test edits and saves the change it fixtures, and an assertion
// about a task file should not depend on whether it ran first.
//
// See a-live-check-names-who-performs-it.

import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer, type OpenSpecUiServer } from "../src/server.js";

let server: OpenSpecUiServer;
let workspaceRoot: string;
let baseUrl: string;

async function change(name: string, tasks: string): Promise<void> {
  const dir = path.join(workspaceRoot, "openspec", "changes", name);
  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(path.join(dir, ".openspec.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(path.join(dir, "proposal.md"), "## Why\n\nFixture.\n", "utf8"),
    writeFile(path.join(dir, "tasks.md"), tasks, "utf8"),
  ]);
}

test.beforeAll(async () => {
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-waiting-"));
  await mkdir(path.join(workspaceRoot, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");

  await change("judged-by-a-person", "## Tasks\n\n- [ ] 1.1 Ordinary\n- [ ] 1.2 **Human-only**: judge whether it reads well\n");
  await change("run-by-an-agent", "## Tasks\n\n- [ ] 2.1 **Delegated to copilot-cli**: quote the audit line\n");
  await change("nobody-at-all", "## Tasks\n\n- [ ] 3.1 **Delegated to copilto-cli**: a typo nothing will run\n");

  server = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await server?.close();
  // Retried, unlike the other e2e fixtures' cleanups: this file now
  // loads the page twice against one workspace, and on Windows the
  // second load's handles outlive `close()` by a few milliseconds — the
  // first run of the second test failed the whole file with `EBUSY:
  // resource busy or locked, rmdir` while every assertion in it had
  // passed. `maxRetries` is what `fs.rm` offers for exactly that.
  if (workspaceRoot) {
    await rm(workspaceRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test("says how much is waiting, and on whom, per row", async ({ page }) => {
  // Same budget as standalone.spec.ts: one page load and one overview
  // read, generous for a loaded runner rather than sized to an idle one.
  test.setTimeout(60_000);

  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
  await page.getByLabel("Workspace root (cwd)").blur();

  // The block lives beside the workspace summary, which is its own tab.
  await page.getByRole("tab", { name: "OpenSpec view summary" }).click();

  const inbox = page.getByTestId("human-only-inbox");
  await expect(inbox).toBeVisible({ timeout: 20_000 });

  // One sentence carrying all three: what waits on a person, what waits
  // on an agent, and the id nothing recognises.
  const basis = page.getByTestId("human-only-inbox-basis");
  await expect(basis).toContainText("3 items waiting, across 3 of 3 active changes");
  await expect(basis).toContainText("1 on a person");
  await expect(basis).toContainText("1 on copilot-cli");
  await expect(basis).toContainText("1 on \"copilto-cli\", which is not a registered agent");

  // And each row says it too, so a reader scanning the list does not
  // have to hold the sentence in their head.
  await expect(inbox).toContainText("judge whether it reads well (waiting on a person)");
  await expect(inbox).toContainText("quote the audit line (waiting on copilot-cli)");
  await expect(inbox).toContainText("(waiting on \"copilto-cli\", which is not a registered agent)");

  // The ordinary open task of the first change is not here: this is what
  // nobody's implementing agent will close, not what is unfinished.
  await expect(inbox).not.toContainText("1.1 Ordinary");
});

test("says the inbox could not be read, rather than showing no block", async ({ page }) => {
  // a-check-that-passes-checked-something: the shell used to set the
  // inbox to `null` when the request failed, so "could not read the task
  // files" and "not loaded yet" rendered identically — nothing at all.
  //
  // The failure is injected at the network rather than by breaking the
  // workspace: what is asserted is the shell's rendering of a refusal,
  // and the server has its own tests for refusing.
  test.setTimeout(60_000);

  await page.route("**/api/human-only-inbox", (route) => route.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({ error: "EACCES: permission denied, scandir 'openspec/changes'" }),
  }));

  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
  await page.getByLabel("Workspace root (cwd)").blur();
  await page.getByRole("tab", { name: "OpenSpec view summary" }).click();

  const inbox = page.getByTestId("human-only-inbox");
  await expect(inbox).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("human-only-inbox-basis"))
    .toContainText("What is waiting could not be read: EACCES: permission denied");

  // The summary beside it still loaded: one read failing is not the
  // other read failing.
  await expect(page.getByTestId("openspec-overview")).toBeVisible();
});
