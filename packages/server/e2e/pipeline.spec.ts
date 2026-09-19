// The Pipeline tab in a real browser: that it draws the order the
// repository declares, that a card says what it waits on in words, and
// that the whole screen passes axe at WCAG AA.
//
// The unit tests drive the view with a written report. This drives it
// through the server, against changes on disk, which is the only way to
// see that the shape core derives survives the trip.
//
// Its second product is docs/images/standalone/pipeline.png — generated
// from the running UI, so it cannot silently disagree with it the way a
// manually captured screenshot already had once (see
// harness-screenshots.spec.ts).

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { agentStatusDirectory } from "@openspec-ui/core";
import { gitIsolationArgs } from "@openspec-ui/core/test-support/git-isolation";
import { createServer, type OpenSpecUiServer } from "../src/server.js";
import { createFakeAgentRunner } from "./fixtures/fake-agent-runner.js";
import { interceptWebSocket } from "./fixtures/intercept-websocket.js";

const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "images", "standalone");

let server: OpenSpecUiServer;
let workspaceRoot: string;
let baseUrl: string;
/** A second working directory of the fixture repository, and the root the
 * survey locates the shared status directory under —
 * what-the-others-are-doing. */
let worktreeRoot: string;
let otherDirectory: string;
/** The worktree of `pipeline-unrelated`. */
let ownDirectory: string;
const worktreeRootBefore = process.env.OPENSPEC_UI_WORKTREE_ROOT;

const run = promisify(execFile);

/** git with this machine's own signing and hooks settings kept out, the
 * way create-dated-workspace.ts commits. */
async function git(cwd: string, args: string[]): Promise<void> {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.com",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.com",
  };
  await run("git", [...(await gitIsolationArgs()), ...args], { cwd, env });
}

/** A run reporting from the other working directory, written just before
 * the page opens so its heartbeat is fresh when the tab reads it. */
async function writeRunInOtherDirectory(): Promise<void> {
  const statusDirectory = agentStatusDirectory(worktreeRoot, workspaceRoot);
  await mkdir(statusDirectory, { recursive: true });
  const at = new Date().toISOString();
  await writeFile(
    path.join(statusDirectory, "fixture-run.json"),
    JSON.stringify({
      version: 1,
      instanceId: "fixture-run",
      activity: "Bash: npm test",
      stage: "apply",
      changeName: "pipeline-elsewhere",
      workingDirectory: otherDirectory,
      activityAt: at,
      heartbeatAt: at,
    }),
    "utf8",
  );
}

/** Three changes: one nothing waits on, one that waits on it, and one
 * unrelated. That is both shapes the picture has to draw — a chain and
 * changes side by side — in the smallest fixture that shows them. */
async function writeChange(changeName: string, blockedBy?: string, root: string = workspaceRoot): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", changeName);
  await mkdir(path.join(changeRoot, "specs", changeName), { recursive: true });
  const meta = blockedBy
    ? `schema: spec-driven\nblocked_by:\n  - ${blockedBy}\n`
    : "schema: spec-driven\n";
  await Promise.all([
    writeFile(path.join(changeRoot, ".openspec.yaml"), meta, "utf8"),
    writeFile(path.join(changeRoot, "proposal.md"), "## Why\n\nFixture.\n", "utf8"),
    writeFile(path.join(changeRoot, "design.md"), "## Context\n\nFixture.\n", "utf8"),
    writeFile(path.join(changeRoot, "tasks.md"), "## Tasks\n\n- [ ] Fixture\n", "utf8"),
    writeFile(
      path.join(changeRoot, "specs", changeName, "spec.md"),
      "## ADDED Requirements\n\n### Requirement: Fixture\nThe system SHALL load.\n",
      "utf8",
    ),
  ]);
}

/** The account a picture would betray: the fixture lives in a temporary
 * directory under the home of whoever regenerates the pictures. */
const ACCOUNT = os.userInfo().username;

/** The locators a documentation picture of the Pipeline masks, all of
 * them lines that print a fixture's temporary directory, which sits under
 * that home (the-docs-catch-up-to-0-55):
 * - every other working directory's "branch — path" line;
 * - every card detail naming one of `paths`, such as a run's "in <path>".
 *   Such a line may be drawn or held beyond the card's "+N"; it is masked
 *   either way, since opening or widening a card draws it. */
function pictureMasks(page: Page, paths: string[]) {
  return [
    // The application bar prints the workspace path, and a full-page
    // picture carries it. The guard below reads the tab's own section, so
    // nothing was checking the bar: the published picture showed the
    // account name in full (what-is-finished-is-tidied-away).
    page.getByTestId("app-bar-workspace"),
    page.locator("[data-testid^='pipeline-directory-'][data-testid$='-where']"),
    ...paths.map((fixturePath) => page.locator(".openspec-pipeline-node-detail").filter({ hasText: fixturePath })),
  ];
}

/** Fails, rather than letting a picture publish the account name, when
 * any text in the section carries it outside the lines `pictureMasks`
 * covers. Those are removed by what they are — the directory lines, and
 * details naming a known fixture path — never by whether they hold the
 * name, so an account name anywhere else still fails here. */
async function expectNoAccountIn(page: Page, testId: string, paths: string[]): Promise<void> {
  const shown = await page.getByTestId(testId).evaluate((root, fixturePaths) => {
    const copy = root.cloneNode(true) as HTMLElement;
    for (const masked of Array.from(copy.querySelectorAll("[data-testid^='pipeline-directory-'][data-testid$='-where']"))) masked.remove();
    for (const detail of Array.from(copy.querySelectorAll(".openspec-pipeline-node-detail"))) {
      if (fixturePaths.some((fixturePath) => (detail.textContent ?? "").includes(fixturePath))) detail.remove();
    }
    return copy.textContent ?? "";
  }, paths);
  expect(shown).not.toContain(ACCOUNT);
}

test.beforeAll(async () => {
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-pipeline-"));
  await mkdir(path.join(workspaceRoot, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  await writeChange("pipeline-first");
  await writeChange("pipeline-second", "pipeline-first");
  await writeChange("pipeline-unrelated");

  // A real repository with a second working directory beside it, holding
  // a change of its own — what-the-others-are-doing. The survey lists
  // worktrees with git and reads everything else from disk, so nothing
  // short of a real worktree shows that the shape survives the trip.
  await git(workspaceRoot, ["init", "-q", "-b", "main"]);
  await git(workspaceRoot, ["add", "."]);
  await git(workspaceRoot, ["commit", "-q", "-m", "workspace"]);
  worktreeRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-pipeline-wt-"));
  process.env.OPENSPEC_UI_WORKTREE_ROOT = worktreeRoot;
  otherDirectory = path.join(worktreeRoot, "proposals");
  await git(workspaceRoot, ["worktree", "add", "-q", "-b", "proposals", otherDirectory, "main"]);
  await writeChange("pipeline-elsewhere", undefined, otherDirectory);
  // a-change-is-running-when-its-run-says-so: a change with a worktree of
  // its own, on a branch named after it. The change is one card, above.
  ownDirectory = path.join(worktreeRoot, "pipeline-unrelated");
  await git(workspaceRoot, ["worktree", "add", "-q", "-b", "pipeline-unrelated", ownDirectory, "main"]);

  // a-card-says-what-its-change-is-doing: the audit log of a chain on
  // pipeline-first that failed at verify. Written after the task list, so
  // the failure is not older than it and still decides the card.
  const endedAt = new Date().toISOString();
  const changeDir = path.join(workspaceRoot, "openspec", "changes", "pipeline-first");
  const entry = (fields: Record<string, unknown>) => JSON.stringify({ runId: "fixture-chain", agent: "claude-cli", cwd: workspaceRoot, changeDir, ...fields });
  await mkdir(path.join(workspaceRoot, ".openspec-ui"), { recursive: true });
  await writeFile(path.join(workspaceRoot, ".openspec-ui", "audit.jsonl"), [
    entry({ outcome: "started", stage: "verify", timestamp: endedAt }),
    entry({ outcome: "failed", stage: "verify", timestamp: endedAt, reason: "the fixture's verify failed", usage: { costUsd: 0.42 } }),
    entry({ agent: "chain", outcome: "failed", stage: "verify", timestamp: endedAt, reason: "verify: the fixture's verify failed" }),
  ].join("\n") + "\n", "utf8");

  server = createServer({ workspaceRoot, host: "127.0.0.1", port: 0 });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await server?.close();
  // Reading the report runs git inside this directory, and on Windows a
  // process's working directory is locked while it lives — a git that
  // has answered but not yet been reaped leaves the directory busy.
  // Tidying is best-effort: the operating system clears its own temp,
  // and failing a green suite over a leftover directory would be
  // reporting the wrong thing.
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true }).catch(() => undefined);
  if (worktreeRoot) await rm(worktreeRoot, { recursive: true, force: true }).catch(() => undefined);
  if (worktreeRootBefore === undefined) delete process.env.OPENSPEC_UI_WORKTREE_ROOT;
  else process.env.OPENSPEC_UI_WORKTREE_ROOT = worktreeRootBefore;
});

/** The lines a card draws only in part: every drawn line — the name, the
 * state, each detail not left beyond the card's budget, and an open card's
 * headings and rows — must end inside its card's padding box. A line of a
 * closed card's hidden list has no box, and is not drawn. */
async function cutLinesIn(page: Page): Promise<string[]> {
  return page.getByTestId("pipeline").evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>(".openspec-pipeline-node")).flatMap((card) => {
      const box = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      const inner = box.bottom - parseFloat(style.borderBottomWidth);
      return Array.from(card.querySelectorAll<HTMLElement>(
        ".openspec-pipeline-node-name, .openspec-pipeline-node-state, .openspec-pipeline-node-detail:not(.openspec-pipeline-node-detail--beyond), .openspec-pipeline-task-section, .openspec-pipeline-task",
      ))
        .filter((line) => line.getClientRects().length > 0 && line.getBoundingClientRect().bottom > inner + 0.5)
        .map((line) => `${card.dataset.testid ?? "a card"}: ${line.textContent ?? ""}`);
    }));
}

/** Every card whose name line reaches into the line below it, or whose open
 * control's icon sits on a line apart from the name. Each name is made long
 * first, as a real change's often is: the fixture's short names fit on one
 * line whatever the layout, and hid the fault the owner saw on a live
 * repository (the-web-ui-screens-wear-metro 7.4). */
async function overlappingNamesIn(page: Page): Promise<string[]> {
  return page.getByTestId("pipeline").evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>(".openspec-pipeline-node")).flatMap((card) => {
      const name = card.querySelector<HTMLElement>(".openspec-pipeline-node-name");
      const state = card.querySelector<HTMLElement>(".openspec-pipeline-node-state");
      const icon = card.querySelector<HTMLElement>(".openspec-pipeline-node-open > [class^='openspec-icon-']");
      if (!name || !state) return [];
      name.textContent = `${name.textContent ?? ""}-with-a-name-long-enough-to-fill-its-card`;
      const nameBox = name.getBoundingClientRect();
      const faults: string[] = [];
      if (nameBox.bottom > state.getBoundingClientRect().top + 0.5) faults.push("name over state");
      if (icon && icon.getBoundingClientRect().bottom <= nameBox.top + 0.5) faults.push("icon on its own line");
      return faults.map((fault) => `${card.dataset.testid ?? "a card"}: ${fault}`);
    }));
}

async function expectNoBlockingViolations(page: Page): Promise<void> {
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blockingViolations = accessibility.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blockingViolations, JSON.stringify(blockingViolations, null, 2)).toEqual([]);
}

test("draws the declared order, and passes axe", async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await writeRunInOtherDirectory();
  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await expect(page.getByTestId("app-bar")).toBeVisible();
  await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);

  await page.getByRole("tab", { name: "Pipeline" }).click();

  // Reading the report lists git worktrees and peeks at each lease, so
  // it is slower than a render; generous, not a behaviour change.
  const blocked = page.getByTestId("pipeline-node-pipeline-second");
  await expect(blocked).toBeVisible({ timeout: 15000 });
  await expect(blocked).toContainText("waiting on pipeline-first");
  await expect(page.getByTestId("pipeline-node-pipeline-first")).toBeVisible();
  await expect(page.getByTestId("pipeline-node-pipeline-unrelated")).toBeVisible();

  // a-card-says-what-its-change-is-doing 6.4: the chain's own ending, read
  // from the audit log, is the card's state word.
  const failed = page.getByTestId("pipeline-node-pipeline-first");
  await expect(failed).toContainText("Failed at verify", { timeout: 15000 });
  await expect(failed).toHaveAttribute("data-state", "failed");
  await expect(failed).toContainText("last run failed at verify");

  // The declared relation is drawn; nothing else is.
  await expect(page.getByTestId("pipeline-edge-pipeline-first-to-pipeline-second")).toBeAttached();

  // what-the-others-are-doing: the branch this picture was read from, and
  // the other working directory beneath it — its own change as a card
  // that is not a control, and what its run says it is doing.
  await expect(page.getByTestId("pipeline-reading-branch")).toContainText("branch main", { timeout: 15000 });
  // Found by name, not by position: git lists worktrees in an order of its
  // own.
  const other = page.getByRole("region", { name: "Working directory proposals" });
  await expect(other).toBeVisible({ timeout: 15000 });
  await expect(other.locator("[data-testid$='-node-pipeline-elsewhere']")).toHaveJSProperty("tagName", "DIV");
  // Its one control shows the tasks this reading holds; nothing reaches the
  // change (a-card-opens-to-its-tasks).
  await expect(other.locator("button:not(.openspec-pipeline-node-disclosure)")).toHaveCount(0);
  await expect(page.getByTestId("pipeline").getByText("Bash: npm test", { exact: false }).first()).toBeVisible();

  // a-change-is-running-when-its-run-says-so 4.7: a change's own worktree
  // says whose it is and does not draw that change a second time; the
  // other changes it holds are still drawn.
  const own = page.getByRole("region", { name: `Working directory ${path.basename(ownDirectory)}` });
  await expect(own).toContainText("The worktree of pipeline-unrelated, which is drawn above.");
  await expect(own.locator("[data-testid$='-node-pipeline-unrelated']")).toHaveCount(0);
  await expect(own.locator("[data-testid$='-node-pipeline-first']")).toHaveCount(1);

  // Every card's name is whole, in this directory's picture and in the
  // other one's. A card has a fixed height, and the first capture of this
  // picture showed a foreign card whose details had squeezed its name out.
  const clippedNames = await page.getByTestId("pipeline").evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>(".openspec-pipeline-node-name"))
      .filter((name) => name.scrollHeight > name.clientHeight)
      .map((name) => name.textContent));
  expect(clippedNames).toEqual([]);

  // the-pipeline-shows-what-it-has-read 3.4: no card draws part of a line.
  expect(await cutLinesIn(page)).toEqual([]);

  // A card is a group named by its change, and its name is a real control,
  // which is what keeps it focusable without any of that having to be
  // supplied by hand (ADR 0025). A card holds controls of its own since
  // a-change-is-run-from-its-card, and a button cannot hold a button.
  // Asserted by focusing it rather than by its accessible name — the name
  // contains everything the card says, so a change that names another one
  // would match a locator looking for that other one.
  const first = page.getByTestId("pipeline-node-pipeline-first");
  await expect(first).toHaveAttribute("role", "group");
  const openFirst = page.getByTestId("pipeline-node-pipeline-first-open");
  await expect(openFirst).toHaveJSProperty("tagName", "BUTTON");
  await openFirst.focus();
  await expect(openFirst).toBeFocused();

  await expectNoBlockingViolations(page);
  expect(pageErrors).toEqual([]);
});

// a-card-opens-to-its-tasks 5.1 and 5.2: a card open to its tasks draws
// every row whole, moves the card below it in its column, passes axe, and
// still cuts no line at 150%. The picture in the documentation is taken
// with that card open.
test("opens a card to its tasks, and cuts no line at any zoom", async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await writeRunInOtherDirectory();
  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
  await page.getByRole("tab", { name: "Pipeline" }).click();

  // pipeline-first and pipeline-unrelated wait on nothing, so they share
  // the first column, in name order.
  const toggle = page.getByTestId("pipeline-node-pipeline-first-tasks-toggle");
  await expect(toggle).toBeVisible({ timeout: 15000 });
  const below = page.getByTestId("pipeline-node-pipeline-unrelated");
  const blocked = page.getByTestId("pipeline-node-pipeline-second");
  const belowBefore = await below.boundingBox();
  const blockedBefore = await blocked.boundingBox();

  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const tasks = page.getByTestId("pipeline-node-pipeline-first-tasks");
  await expect(tasks).toBeVisible();
  await expect(tasks).toContainText("Tasks");
  await expect(tasks).toContainText("Fixture");
  // the-pipeline-cards-wear-metro: the legend explains the line between cards,
  // and no line is drawn between an open card's rows.
  await expect(page.getByTestId("pipeline-legend")).toContainText("the second waits for the first");
  await expect(tasks.locator(".openspec-pipeline-task-rail")).toHaveCount(0);
  await expect.poll(async () => (await below.boundingBox())?.y ?? 0).toBeGreaterThan(belowBefore?.y ?? 0);
  // A card in another column does not move.
  expect((await blocked.boundingBox())?.y).toBe(blockedBefore?.y);
  expect(await cutLinesIn(page)).toEqual([]);

  // the-docs-catch-up-to-0-55 1.5: every other working directory's path is
  // masked, and nothing else on the page may carry the account name. The
  // picture published before this showed both paths in full.
  const fixturePaths = [workspaceRoot, worktreeRoot];
  await expectNoAccountIn(page, "pipeline", fixturePaths);
  await page.screenshot({
    path: path.join(IMAGES_DIR, "pipeline.png"),
    fullPage: true,
    mask: pictureMasks(page, fixturePaths),
    maskColor: "#94a3b8",
  });
  await expectNoBlockingViolations(page);

  await page.getByTestId("pipeline-zoom-in").click();
  await page.getByTestId("pipeline-zoom-in").click();
  await expect(page.getByTestId("pipeline-zoom-level")).toHaveText("Zoom 150%");
  expect(await cutLinesIn(page)).toEqual([]);
  // Last, since it lengthens the names on the page it measures.
  expect(await overlappingNamesIn(page)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

/** Leaves the Pipeline tab and comes back, which reads every reading
 * again, instead of waiting out the survey's thirty seconds. */
async function readPipelineAgain(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Change Editor" }).click();
  await page.getByRole("tab", { name: "Pipeline" }).click();
}

// a-change-is-run-from-its-card 6.1: a chain started from its card, its
// checkpoint answered on the card, and a stop asked for there with a
// reason. The stand-in holds the verify stage open, so the stop is asked
// while a stage runs and stays pending for the card to state.
test("starts a chain from its card, answers it there, and asks it to stop", async ({ page }) => {
  // Start (up to 45 s), Continue until a stage runs (up to 90 s), then the
  // stop and its pictures; see 4.4 of the-docs-catch-up-to-0-55.
  test.setTimeout(240000);
  const changeName = "pipeline-run";
  const runRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-pipeline-run-"));
  await mkdir(path.join(runRoot, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(runRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  await writeChange(changeName, undefined, runRoot);
  // Semi-autonomous, so the run dialog offers the chain and the chain
  // stops at a checkpoint between stages.
  await writeFile(
    path.join(runRoot, "openspec", "changes", changeName, "harness.json"),
    `${JSON.stringify({ autonomyLevel: "semi-autonomous", stepAgents: { apply: "claude-cli", verify: "claude-cli" } }, null, 2)}\n`,
    "utf8",
  );
  await git(runRoot, ["init", "-q", "-b", "main"]);
  // A stop names who asked by the working directory's git identity. Set
  // here, so the card reads the fixture's identity rather than the machine's
  // own, which a documentation picture would otherwise publish
  // (the-docs-catch-up-to-0-55 1.1).
  await git(runRoot, ["config", "user.email", "fixture@example.com"]);
  await git(runRoot, ["config", "user.name", "Fixture"]);
  await git(runRoot, ["add", "."]);
  await git(runRoot, ["commit", "-q", "-m", "workspace"]);

  let releaseVerify: () => void = () => undefined;
  const verifyGate = new Promise<void>((resolve) => { releaseVerify = resolve; });
  const runServer = createServer({
    workspaceRoot: runRoot,
    host: "127.0.0.1",
    port: 0,
    runners: new Map([["claude-cli", createFakeAgentRunner({ changeName, verifyGate })]]),
  });
  const address = await runServer.listen();
  // The chain keeps the page's WebSocket open, and `close()` waits for
  // every client: see fixtures/intercept-websocket.ts.
  const socket = await interceptWebSocket(page);
  try {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(runServer.accessToken)}`);
    await page.getByLabel("Workspace root (cwd)").fill(runRoot);
    await page.getByRole("tab", { name: "Pipeline" }).click();

    // 1. Start, on the card: the run dialog opens beneath the picture with
    // focus in it, and the chain it starts is shown there too.
    const start = page.getByTestId(`pipeline-start-${changeName}`);
    await expect(async () => {
      await readPipelineAgain(page);
      await expect(start).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });
    await start.click();
    const layer = page.getByTestId("pipeline-run-layer");
    const dialog = layer.getByTestId("run-dialog");
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog).toBeFocused();
    await dialog.getByTestId("run-dialog-path-chain").click();
    const chain = layer.getByTestId("pipeline-run-chain");
    await expect(chain).toBeFocused();
    await chain.getByTestId("start-chain-button").click();
    await expect(chain.getByTestId("checkpoint-confirmation")).toBeVisible({ timeout: 15000 });

    // 2. Continue, on the card, at every checkpoint until a stage runs.
    // What stages come before verify is the harness's own default; the
    // stand-in holds verify, where the card then offers Stop and no
    // Continue.
    const continueOnCard = page.getByTestId(`pipeline-continue-${changeName}`);
    const stopOnCard = page.getByTestId(`pipeline-stop-${changeName}`);
    await expect(async () => {
      await readPipelineAgain(page);
      await expect(continueOnCard).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });
    // Every click on the card has its own timeout. A click waits for its
    // element to be stable, and the card's line of what the run says moves
    // while it counts its age: on CI a click on Continue waited for that for
    // the whole of `toPass`'s window, so the predicate never returned to be
    // retried (the-docs-catch-up-to-0-55 4.4). A click that times out now
    // fails one pass, and the next pass reads the card again.
    await expect(async () => {
      await readPipelineAgain(page);
      if (await continueOnCard.isVisible()) await continueOnCard.click({ timeout: 5000 });
      await expect(continueOnCard).toBeHidden({ timeout: 10000 });
      await expect(stopOnCard).toBeVisible({ timeout: 10000 });
    }).toPass({ timeout: 90000 });

    // 3. Stop, with a reason, through a form that passes axe while open.
    await stopOnCard.click();
    const form = page.getByRole("dialog", { name: `Ask ${changeName} to stop` });
    await expect(form).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blockingViolations = accessibility.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blockingViolations, JSON.stringify(blockingViolations, null, 2)).toEqual([]);
    await form.getByTestId("pipeline-stop-reason").fill("wrong branch");
    // the-docs-catch-up-to-0-55 1.1: the reason, whole, where it is given.
    // A card draws its details one line each, and this one's line is cut at
    // the card's width, so the picture of the card cannot show the reason.
    await expect(form.getByTestId("pipeline-stop-reason")).toHaveValue("wrong branch");
    await form.screenshot({ path: path.join(IMAGES_DIR, "pipeline-stop-ask.png") });
    await form.getByTestId("pipeline-ask-to-stop").click();
    await expect(form).toBeHidden();

    // 4. The card states the request, from the run's record, while the
    // stage it waits on is still open.
    const card = page.getByTestId(`pipeline-node-${changeName}`);
    await expect(card).toContainText("asked to stop", { timeout: 15000 });
    await expect(card).toContainText("wrong branch");
    await expect(card).toContainText("by fixture@example.com");

    // the-docs-catch-up-to-0-55 1.1: the picture the documentation shows
    // for a run asked to stop, taken once the card states the request, so
    // the caption cannot outrun the screen. The whole Pipeline section, not
    // the card alone, so a reader sees where the card sits.
    // The run's own card carries "in <runRoot>" among its details.
    await expectNoAccountIn(page, "pipeline", [runRoot]);
    await page.getByTestId("pipeline").screenshot({
      path: path.join(IMAGES_DIR, "pipeline-stop.png"),
      mask: pictureMasks(page, [runRoot]),
      maskColor: "#94a3b8",
    });
    expect(pageErrors).toEqual([]);
  } finally {
    releaseVerify();
    await socket.current?.close();
    await runServer.close();
    await rm(runRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(() => undefined);
  }
});

test("becomes headed lanes at phone width, with no lines", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto(`${baseUrl}/#token=${encodeURIComponent(server.accessToken)}`);
  await page.getByLabel("Workspace root (cwd)").fill(workspaceRoot);
  await page.getByRole("tab", { name: "Pipeline" }).click();

  await expect(page.getByTestId("pipeline-node-pipeline-first")).toBeVisible({ timeout: 15000 });
  // The cards are still there and still say what they wait on; only the
  // drawing of it is gone, because four columns do not fit a phone.
  await expect(page.getByTestId("pipeline-edges")).toBeHidden();
  // Scoped to this directory's picture: every other working directory's
  // picture has a first step of its own.
  await expect(page.getByTestId("pipeline-picture").getByRole("heading", { name: "Step 1 · can start now" })).toBeVisible();

  // a-card-opens-to-its-tasks 3.7: an open card lists its rows in its
  // lane, with no fixed height, so none of them is cut.
  await page.getByTestId("pipeline-node-pipeline-first-tasks-toggle").click();
  await expect(page.getByTestId("pipeline-node-pipeline-first-tasks")).toBeVisible();
  expect(await cutLinesIn(page)).toEqual([]);

  // The page body never scrolls sideways — the picture scrolls in its
  // own container instead.
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
