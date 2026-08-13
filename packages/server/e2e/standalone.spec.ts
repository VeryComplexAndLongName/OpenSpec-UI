import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer, type OpenSpecUiServer } from "../src/server.js";

const CHANGE_NAME = "browser-journey";

let server: OpenSpecUiServer;
let workspaceRoot: string;
let baseUrl: string;

test.beforeAll(async () => {
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-browser-"));
  const changeRoot = path.join(workspaceRoot, "openspec", "changes", CHANGE_NAME);
  await mkdir(path.join(changeRoot, "specs", CHANGE_NAME), { recursive: true });
  await mkdir(path.join(workspaceRoot, "openspec", "specs"), { recursive: true });
  await Promise.all([
    writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(path.join(changeRoot, ".openspec.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(path.join(changeRoot, "proposal.md"), "## Why\n\nOriginal proposal.\n", "utf8"),
    writeFile(path.join(changeRoot, "design.md"), "## Context\n\nBrowser fixture.\n", "utf8"),
    writeFile(path.join(changeRoot, "tasks.md"), "## Tasks\n\n- [ ] Browser journey\n", "utf8"),
    writeFile(
      path.join(changeRoot, "specs", CHANGE_NAME, "spec.md"),
      "## ADDED Requirements\n\n### Requirement: Browser fixture\nThe system SHALL load.\n",
      "utf8",
    ),
  ]);

  server = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await server?.close();
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
});

test("loads, edits, and saves an accessible standalone change", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await expect(page.getByRole("heading", { name: "OpenSpec UI", level: 1 })).toBeVisible();

  await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
  await page.getByRole("button", { name: "Load summary" }).click();
  await expect(page.getByTestId("openspec-overview")).toContainText(CHANGE_NAME);

  await page.locator("section", { has: page.getByRole("heading", { name: "Change Editor" }) })
    .getByRole("combobox")
    .selectOption(CHANGE_NAME);
  await page.getByRole("button", { name: "Load change", exact: true }).click();
  await expect(page.getByText(`Loaded ${CHANGE_NAME}.`)).toBeVisible();

  const proposalEditor = page.getByLabel("Markdown (proposal)");
  await proposalEditor.fill("## Why\n\nUpdated in Chromium.\n");
  await page.getByRole("button", { name: "Save markdown" }).click();
  await expect(page.getByText(`Saved ${CHANGE_NAME}.`)).toBeVisible();

  const proposalPath = path.join(workspaceRoot, "openspec", "changes", CHANGE_NAME, "proposal.md");
  await expect.poll(() => readFile(proposalPath, "utf8")).toContain("Updated in Chromium.");

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blockingViolations = accessibility.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blockingViolations, JSON.stringify(blockingViolations, null, 2)).toEqual([]);
  expect(pageErrors).toEqual([]);
});