import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer, type OpenSpecUiServer } from "../src/server.js";

test("defers a proposal from its Pipeline card and restores it with the recorded reason", async ({ page }) => {
  test.setTimeout(90_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "osw-disposition-browser-"));
  const changeName = "waiting-for-api";
  const change = path.join(root, "openspec", "changes", changeName);
  const proposal = "## Why\nThe API will change.\n";
  let server: OpenSpecUiServer | undefined;
  try {
    await mkdir(change, { recursive: true });
    await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n");
    await writeFile(path.join(change, "proposal.md"), proposal);
    server = createServer({ workspaceRoot: root, host: "127.0.0.1", port: 0, runners: new Map() });
    const address = await server.listen();
    await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
    await page.getByRole("tab", { name: "Pipeline", exact: true }).click();
    const cardAction = page.getByRole("button", { name: `Set Change Disposition ${changeName}`, exact: true });
    await cardAction.click();
    const dialog = page.getByRole("dialog", { name: `Set Change Disposition ${changeName}` });
    await dialog.getByLabel("Disposition", { exact: true }).selectOption("deferred");
    await dialog.getByLabel("Reason", { exact: true }).fill("Waiting for the next API version");
    await dialog.getByRole("button", { name: "Save Change Disposition" }).click();
    await expect(dialog.getByLabel("Disposition", { exact: true })).toHaveValue("deferred");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();

    await expect(page.getByText("deferred: Waiting for the next API version")).toBeVisible({ timeout: 20_000 });
    await expect(cardAction).toHaveCount(0);
    await page.getByRole("button", { name: `Set Change Disposition for ${changeName}`, exact: true }).click();
    await dialog.getByText("Disposition history", { exact: true }).click();
    await expect(dialog.getByText(/Waiting for the next API version/u)).toBeVisible();
    await dialog.getByLabel("Disposition", { exact: true }).selectOption("active");
    await dialog.getByLabel("Reason", { exact: true }).fill("The new API is available");
    await dialog.getByRole("button", { name: "Save Change Disposition" }).click();
    await expect(dialog.getByLabel("Disposition", { exact: true })).toHaveValue("active");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(cardAction).toBeVisible({ timeout: 20_000 });
    expect(await readFile(path.join(change, "proposal.md"), "utf8")).toBe(proposal);
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
