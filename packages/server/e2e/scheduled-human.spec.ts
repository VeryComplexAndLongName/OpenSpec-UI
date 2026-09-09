import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer, type OpenSpecUiServer } from "../src/server.js";

let server: OpenSpecUiServer;
let workspaceRoot: string;
let baseUrl: string;

test.beforeAll(async () => {
    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-scheduled-human-"));
    const changeRoot = path.join(workspaceRoot, "openspec", "changes", "scheduled-demo");
    await mkdir(changeRoot, { recursive: true });
    await writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
    await writeFile(path.join(changeRoot, "proposal.md"), "## Why\n\nScheduled smoke test.\n", "utf8");
    await writeFile(path.join(changeRoot, "tasks.md"), "## Tasks\n\n- [ ] 1.1 Wait for the scheduled run.\n", "utf8");
    server = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
    const address = await server.listen();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
    await server?.close();
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
});

async function openRunDialog(page: import("@playwright/test").Page): Promise<void> {
    await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
    await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
    await page.getByRole("tab", { name: "OpenSpec view summary" }).click();
    await page.getByRole("button", { name: "Load summary" }).click();
    await expect(page.getByTestId("openspec-overview")).toContainText("scheduled-demo", { timeout: 15000 });
    await page.getByRole("tab", { name: "Change Editor" }).click();
    await page.getByLabel("Change to edit").selectOption("scheduled-demo");
    await page.getByTestId("run-with-harness-button").click();
    await expect(page.getByTestId("run-dialog")).toBeVisible({ timeout: 15000 });
}

function nextMinute(): string {
    const start = new Date(Date.now() + 90_000);
    start.setSeconds(0, 0);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
}

test("a scheduled run opens on time, and a closed application reports lateness on reopen", async ({ page }) => {
    test.setTimeout(300000);
    await openRunDialog(page);
    await page.getByLabel("Start at").fill(nextMinute());
    await page.getByTestId("run-dialog-schedule-single-stage").click();
    await expect(page.getByText(/Scheduled scheduled-demo for/)).toBeVisible();
    await expect(page.getByTestId("run-dialog-note")).toBeVisible({ timeout: 150000 });
    await expect(page.getByTestId("run-dialog-note")).toContainText("Scheduled run");

    await page.getByTestId("run-dialog-cancel").click();
    await openRunDialog(page);
    await page.getByLabel("Start at").fill(nextMinute());
    await page.getByTestId("run-dialog-schedule-single-stage").click();
    await expect(page.getByText(/Scheduled scheduled-demo for/)).toBeVisible();
    await page.close();

    await new Promise((resolve) => setTimeout(resolve, 100_000));
    const reopened = await page.context().newPage();
    await reopened.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
    await reopened.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
    await reopened.getByRole("tab", { name: "OpenSpec view summary" }).click();
    await reopened.getByRole("button", { name: "Load summary" }).click();
    await expect(reopened.getByTestId("openspec-overview")).toContainText("scheduled-demo", { timeout: 15000 });
    await expect(reopened.getByTestId("run-dialog-note")).toContainText("late", { timeout: 15000 });
    await reopened.close();
});