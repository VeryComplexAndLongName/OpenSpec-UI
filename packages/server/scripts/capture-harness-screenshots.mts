// Dev-only screenshot regeneration tool for the Agentic Harness docs
// (openspec/changes/agentic-harness-screenshots/) — NOT a CI test, not
// wired into playwright.config.ts/npm run test:browser. Run with:
//   npx tsx packages/server/scripts/capture-harness-screenshots.mts
// Mirrors e2e/standalone.spec.ts's fixture/auth pattern (temp workspace +
// #token= URL fragment), but drives the browser to capture PNGs instead
// of asserting behavior.

import { chromium } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../src/server.js";

const CHANGE_NAME = "agentic-harness-autonomy";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "..", "..", "..", "docs", "images", "standalone");

async function buildFixtureWorkspace(): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-harness-screenshots-"));
  const changeRoot = path.join(workspaceRoot, "openspec", "changes", CHANGE_NAME);
  await mkdir(path.join(changeRoot, "specs", "agentic-harness"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "openspec", "specs"), { recursive: true });
  await Promise.all([
    writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(
      path.join(workspaceRoot, "openspec", "agent-harness.json"),
      `${JSON.stringify(
        {
          stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "copilot-cli", archive: "claude-cli" },
          autonomyLevel: "assisted",
          reviewGate: { mode: "human-required" },
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    writeFile(path.join(changeRoot, ".openspec.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(
      path.join(changeRoot, "proposal.md"),
      "## Why\n\nMake semi-autonomous/autonomous chain execution functional.\n",
      "utf8",
    ),
    writeFile(path.join(changeRoot, "design.md"), "## Context\n\nScreenshot fixture.\n", "utf8"),
    writeFile(
      path.join(changeRoot, "tasks.md"),
      "## 1. Protocol\n\n- [x] 1.1 Add chain command\n- [ ] 1.2 Add tests\n",
      "utf8",
    ),
    writeFile(
      path.join(changeRoot, "specs", "agentic-harness", "spec.md"),
      "## ADDED Requirements\n\n### Requirement: Screenshot fixture\nThe system SHALL load.\n",
      "utf8",
    ),
  ]);
  return workspaceRoot;
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const workspaceRoot = await buildFixtureWorkspace();
  const server = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
  const address = await server.listen();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
    await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);

    // Loads overview.changes, which the Change Editor tab's "Select
    // change" combobox reads from — mirrors e2e/standalone.spec.ts.
    await page.getByRole("tab", { name: "OpenSpec view summary" }).click();
    await page.getByRole("button", { name: "Load summary" }).click();
    await page.getByTestId("openspec-overview").getByText(CHANGE_NAME).waitFor({ timeout: 15000 });

    // Harness Settings tab.
    await page.getByRole("tab", { name: "Harness Settings" }).click();
    await page.getByRole("heading", { name: "Global default" }).waitFor();
    await page.waitForTimeout(300); // let the async resolveGlobal() fill fields in
    await page.screenshot({ path: path.join(outDir, "harness-settings.png") });
    console.log("Saved harness-settings.png");

    // Change Editor tab's "Run with Agentic Harness" button.
    await page.getByRole("tab", { name: "Change Editor" }).click();
    await page
      .locator("section", { has: page.getByRole("heading", { name: "Change Editor" }) })
      .getByRole("combobox")
      .selectOption(CHANGE_NAME);
    await page.getByRole("button", { name: "Load change", exact: true }).click();
    await page.getByText(`Loaded ${CHANGE_NAME}.`).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, "run-with-harness.png") });
    console.log("Saved run-with-harness.png");
  } finally {
    await browser.close();
    await server.close();
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
