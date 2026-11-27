import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { gitIsolationArgs } from "@openspec-ui/core/test-support/git-isolation";
import { createServer, type OpenSpecUiServer } from "../src/server.js";

test("imports JUnit, previews and saves a testcase mapping, and copies qualified results", async ({ page, context }) => {
  test.setTimeout(90_000);
  const reviewExpect = expect.configure({ timeout: 20_000 });
  const root = await mkdtemp(path.join(os.tmpdir(), "osw-junit-browser-"));
  let server: OpenSpecUiServer | undefined;
  let forge: ReturnType<typeof createHttpServer> | undefined;
  const previousForgeUrl = process.env.GITLAB_URL;
  const previousForgeToken = process.env.GITLAB_TOKEN;
  const execute = promisify(execFile);
  const git = async (...args: string[]) => (await execute("git", [...await gitIsolationArgs(), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", ...args], { cwd: root })).stdout.trim();
  try {
    const change = path.join(root, "openspec", "changes", "junit-demo");
    await mkdir(path.join(change, "specs", "auth"), { recursive: true });
    await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n");
    await writeFile(path.join(change, ".openspec.yaml"), "schema: spec-driven\n");
    await writeFile(path.join(change, "proposal.md"), "## Why\nSession expiry.\n");
    await writeFile(path.join(change, "tasks.md"), "- [ ] Verify session expiry.\n");
    await writeFile(path.join(change, "specs", "auth", "spec.md"), "## ADDED Requirements\n### Requirement: Session expires\nThe session SHALL expire.\n#### Scenario: Expired session\n- **WHEN** it expires\n- **THEN** access is refused\n");
    const names = ["accept", "reject", "broken", "later", "absent", "duplicate"];
    await writeFile(path.join(change, "scenario-tests.json"), JSON.stringify({ scenarios: [{
      capability: "auth", requirement: "Session expires", scenario: "Expired session",
      tests: names.map((name) => ({ classname: "SessionTests", name })),
    }] }));
    await git("init", "-b", "main"); await git("add", "."); await git("commit", "-m", "JUnit browser fixture");
    const head = await git("rev-parse", "HEAD");
    forge = createHttpServer((request, response) => {
      const job = "/api/v4/projects/team%2Fapp/jobs/7";
      if (request.url === job) response.end(JSON.stringify({ id: 7, commit: { id: head }, pipeline: { id: 12, sha: head } }));
      else if (request.url === `${job}/artifacts/tested-commit.txt`) response.end(head);
      else if (request.url === `${job}/artifacts/junit.xml`) response.end('<testsuite><testcase classname="SessionTests" name="accept"/></testsuite>');
      else if (request.url?.startsWith("/api/v4/projects/team%2Fapp/merge_requests?")) response.end("[]");
      else { response.statusCode = 404; response.end(); }
    });
    forge.listen(0, "127.0.0.1");
    await once(forge, "listening");
    const forgeUrl = `http://127.0.0.1:${(forge.address() as AddressInfo).port}`;
    process.env.GITLAB_URL = forgeUrl;
    process.env.GITLAB_TOKEN = "junit-browser-fixture";
    await git("remote", "add", "origin", `${forgeUrl}/team/app.git`);
    server = createServer({ workspaceRoot: root, host: "127.0.0.1", port: 0, runners: new Map() });
    const address = await server.listen();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
    await page.getByRole("tab", { name: "Pipeline", exact: true }).click();
    await page.getByRole("button", { name: "Show PR Review junit-demo", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Show PR Review junit-demo" });
    await dialog.getByRole("button", { name: "Import JUnit XML", exact: true }).click();
    await expect(dialog.getByLabel("Tested commit (user-declared)")).toHaveValue("");
    await dialog.getByLabel("JUnit XML report (up to 128 KiB)").setInputFiles({
      name: "junit.xml", mimeType: "application/xml", buffer: Buffer.from('<testsuites><testsuite><testcase classname="SessionTests" name="accept"/><testcase classname="SessionTests" name="reject"><failure>PRIVATE OUTPUT</failure></testcase><testcase classname="SessionTests" name="broken"><error/></testcase><testcase classname="SessionTests" name="later"><skipped/></testcase><testcase classname="SessionTests" name="duplicate"/><testcase classname="SessionTests" name="duplicate"/><testcase classname="SessionTests" name="new case"/></testsuite></testsuites>'),
    });
    await dialog.getByLabel("Tested commit (user-declared)").fill(head);
    await dialog.getByRole("button", { name: "Import Report", exact: true }).click();
    for (const [name, state] of [["accept", "passed"], ["reject", "failed"], ["broken", "error"], ["later", "skipped"], ["absent", "missing"], ["duplicate", "ambiguous"]]) {
      await reviewExpect(dialog).toContainText(new RegExp(`${name}\\s*:\\s*${state}`, "u"));
    }
    await expect(dialog).toContainText("User-declared tested commit");
    await expect(dialog).toContainText("not independently verified");
    await dialog.getByRole("button", { name: "Copy PR summary", exact: true }).click();
    await expect(dialog.getByRole("status")).toHaveText("PR summary copied.");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("User-declared tested commit");
    expect(copied).toContain(head);
    expect(copied).toContain("ambiguous (duplicate test identity)");
    expect(copied).not.toContain("PRIVATE OUTPUT");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Show PR Review junit-demo", exact: true }).click();
    await reviewExpect(dialog).toContainText("ambiguous (duplicate test identity)");
    await dialog.getByRole("button", { name: "Link scenario to JUnit test", exact: true }).click();
    await dialog.getByLabel("OpenSpec scenario").selectOption("0");
    await dialog.getByLabel("Search JUnit tests").fill("new case");
    await dialog.getByLabel("JUnit testcase").selectOption({ label: "SessionTests / new case (passed)" });
    await dialog.getByRole("button", { name: "Show Test Mapping Preview" }).click();
    await reviewExpect(dialog.getByLabel("JUnit mapping diff")).toContainText("new case");
    expect(await git("status", "--porcelain")).toBe("");
    await dialog.getByRole("button", { name: "Save Test Mapping" }).click();
    await reviewExpect(dialog).toContainText("Test mapping saved.");
    expect(await git("diff", "--", "openspec/changes/junit-demo/scenario-tests.json")).toContain('"name": "new case"');
    await dialog.getByRole("button", { name: "Import CI JUnit Report", exact: true }).click();
    await dialog.getByLabel("GitLab job ID").fill("7");
    await dialog.getByRole("form", { name: "Import CI JUnit Report" })
      .getByRole("button", { name: "Import CI JUnit Report", exact: true }).click();
    await reviewExpect(dialog).toContainText("job #7, pipeline #12");
    await expect(dialog).toContainText("execution metadata agreed");
    await dialog.getByRole("button", { name: "Edit Review Findings", exact: true }).click();
    await dialog.getByLabel("Finding", { exact: true }).fill("Check missing postal code");
    await dialog.getByLabel("Repository path (optional)").fill("openspec/changes/junit-demo/proposal.md");
    await dialog.getByLabel("Line (optional)").fill("1");
    await dialog.getByRole("button", { name: "Add Review Finding", exact: true }).click();
    await reviewExpect(dialog).toContainText("Check missing postal code");
    await dialog.getByRole("button", { name: "Edit Review Findings", exact: true }).click();
    await dialog.getByLabel("Recorded finding").selectOption({ label: "Check missing postal code (open)" });
    await dialog.getByLabel("Decision", { exact: true }).selectOption("dismissed");
    await dialog.getByLabel("Decision note").fill("The request is unrelated to the expiry fixture.");
    await dialog.getByRole("button", { name: "Save Review Decision", exact: true }).click();
    await reviewExpect(dialog).toContainText("dismissed:");
    await expect(dialog).toContainText("The request is unrelated to the expiry fixture.");
  } finally {
    if (previousForgeUrl === undefined) delete process.env.GITLAB_URL;
    else process.env.GITLAB_URL = previousForgeUrl;
    if (previousForgeToken === undefined) delete process.env.GITLAB_TOKEN;
    else process.env.GITLAB_TOKEN = previousForgeToken;
    await server?.close();
    const fixtureForge = forge;
    if (fixtureForge) await new Promise<void>((resolve) => fixtureForge.close(() => resolve()));
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
