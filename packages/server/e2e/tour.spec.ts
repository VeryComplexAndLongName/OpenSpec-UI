// Records the tour the README opens with: the Pipeline, a run started from
// a change's card, a checkpoint answered there, and a stop asked for with a
// reason. It writes the recording twice:
//
// - `docs/images/standalone/tour.gif`, for the README, where a video does not
//   play;
// - `docs/images/standalone/tour.webm`, for the project site and the
//   articles, which accept it.
//
// Regenerate with (from packages/server):
// `npm run test:browser -- tour.spec.ts`.
//
// The storyboard, each step held for as long as a reader needs it (the whole
// recording is at most twenty seconds, at most twelve frames a second):
//
//   1. The Pipeline: three changes, one waiting on another.      3.0 s
//   2. Start on a card: the run dialog opens.                     2.0 s
//   3. The chain starts and stops at its first checkpoint.        2.5 s
//   4. Continue on the card until a stage runs; the card offers
//      Stop.                                                      2.5 s
//   5. Stop asked for, with a reason typed into the form.         2.1 s
//   6. The card says the run was asked to stop, and by whom.      4.0 s
//
// The agent is the fake runner, so the recording is the same every time and
// spends no tokens. It is built from photographs, not from the browser's own
// video: see fixtures/tour-recording.ts for why, and for what a recording of
// this repository may weigh. Every photograph is masked the way the
// documentation stills are, because a recording cannot be masked afterwards
// and the fixture sits in a temporary directory under the home of whoever
// regenerates it.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gitIsolationArgs } from "@openspec-ui/core/test-support/git-isolation";
import { createServer } from "../src/server.js";
import { createFakeAgentRunner } from "./fixtures/fake-agent-runner.js";
import { interceptWebSocket } from "./fixtures/intercept-websocket.js";
import { LIMITS, problemsWith, writeGif, writeWebm, type Photograph } from "./fixtures/tour-recording.js";

const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "images", "standalone");
const CHANGE_NAME = "tour-run";
/** The account a photograph would betray. */
const ACCOUNT = os.userInfo().username;
/** A flat grey, so a covered field reads as covered on purpose. */
const MASK_COLOR = "#94a3b8";

test.use({ viewport: { width: LIMITS.width, height: 900 } });

const run = promisify(execFile);

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

async function writeChange(root: string, changeName: string, blockedBy?: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", changeName);
  await mkdir(path.join(changeRoot, "specs", changeName), { recursive: true });
  const meta = blockedBy ? `schema: spec-driven\nblocked_by:\n  - ${blockedBy}\n` : "schema: spec-driven\n";
  await Promise.all([
    writeFile(path.join(changeRoot, ".openspec.yaml"), meta, "utf8"),
    writeFile(path.join(changeRoot, "proposal.md"), "## Why\n\nA change to tour.\n", "utf8"),
    writeFile(path.join(changeRoot, "design.md"), "## Context\n\nA change to tour.\n", "utf8"),
    writeFile(path.join(changeRoot, "tasks.md"), "## Tasks\n\n- [ ] Write it\n- [ ] Check it\n", "utf8"),
    writeFile(
      path.join(changeRoot, "specs", changeName, "spec.md"),
      "## ADDED Requirements\n\n### Requirement: A capability\nThe system SHALL do it.\n",
      "utf8",
    ),
  ]);
}

/** Leaves the Pipeline tab and comes back, which reads every reading again
 * instead of waiting out the survey's thirty seconds. */
async function readPipelineAgain(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Change Editor" }).click();
  await page.getByRole("tab", { name: "Pipeline" }).click();
}

/** Every element of the screen that prints where the fixture lives. */
function pathElements(page: Page, runRoot: string) {
  return [
    page.getByTestId("app-bar-workspace"),
    page.getByLabel("Workspace root (cwd)"),
    page.getByLabel("Change directory"),
    page.locator("[data-testid^='pipeline-directory-'][data-testid$='-where']"),
    page.locator(".openspec-pipeline-node-detail").filter({ hasText: runRoot }),
  ];
}

/** Fails, rather than photographing the account name or the fixture's
 * path, when the screen carries either outside the elements that are
 * covered. Those are removed by what they are, never by whether they hold
 * the name, so it turning up anywhere else still fails here. */
async function expectNothingBetrayed(page: Page, runRoot: string): Promise<void> {
  const shown = await page.evaluate(() => {
    const copy = document.body.cloneNode(true) as HTMLElement;
    for (const covered of Array.from(copy.querySelectorAll(
      "[data-testid='app-bar-workspace'], [aria-label='Workspace root (cwd)'], [aria-label='Change directory'], [data-testid^='pipeline-directory-'][data-testid$='-where']",
    ))) covered.remove();
    const values = Array.from(copy.querySelectorAll("input, textarea")).map((field) => (field as HTMLInputElement).value);
    return [copy.textContent ?? "", ...values].join("\n");
  });
  // The run's own card details name the fixture's path and are covered by
  // what they are: a detail holding it.
  const uncovered = await page.evaluate((fixture) => {
    return Array.from(document.querySelectorAll(".openspec-pipeline-node-detail"))
      .filter((detail) => !(detail.textContent ?? "").includes(fixture))
      .map((detail) => detail.textContent ?? "").join("\n");
  }, runRoot);
  const withoutCoveredDetails = shown.split(runRoot).join("");
  expect(withoutCoveredDetails, "the screen prints the account name").not.toContain(ACCOUNT);
  expect(uncovered, "an uncovered card detail prints the account name").not.toContain(ACCOUNT);
}

test("records the tour: a run started from a card, answered there, and asked to stop", async ({ page }) => {
  // Start (up to 45 s), Continue until a stage runs (up to 90 s), then the
  // stop. The recording holds each step for a few seconds; the waits are not
  // in it.
  test.setTimeout(240000);
  const runRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-tour-"));
  await mkdir(path.join(runRoot, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(runRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  await writeChange(runRoot, "tour-parser");
  await writeChange(runRoot, "tour-export", "tour-parser");
  await writeChange(runRoot, CHANGE_NAME);
  // Semi-autonomous, so the run dialog offers the chain and the chain stops
  // at a checkpoint between stages.
  await writeFile(
    path.join(runRoot, "openspec", "changes", CHANGE_NAME, "harness.json"),
    `${JSON.stringify({ autonomyLevel: "semi-autonomous", stepAgents: { apply: "claude-cli", verify: "claude-cli" } }, null, 2)}\n`,
    "utf8",
  );
  await git(runRoot, ["init", "-q", "-b", "main"]);
  // A stop names who asked by the working directory's git identity: the
  // fixture's, so the photograph does not publish the machine's own.
  await git(runRoot, ["config", "user.email", "fixture@example.com"]);
  await git(runRoot, ["config", "user.name", "Fixture"]);
  await git(runRoot, ["add", "."]);
  await git(runRoot, ["commit", "-q", "-m", "workspace"]);

  let releaseVerify: () => void = () => undefined;
  const verifyGate = new Promise<void>((resolve) => { releaseVerify = resolve; });
  const server = createServer({
    workspaceRoot: runRoot,
    host: "127.0.0.1",
    port: 0,
    runners: new Map([["claude-cli", createFakeAgentRunner({ changeName: CHANGE_NAME, verifyGate })]]),
  });
  const address = await server.listen();
  const socket = await interceptWebSocket(page);
  const photographs: Photograph[] = [];

  /** Photographs the screen and says how long the recording holds it. The
   * page is first scrolled to what the step is about, so a photograph does
   * not depend on where the last click left it. */
  async function photograph(holdMs: number, about?: Locator): Promise<void> {
    if (about) await about.evaluate((element) => element.scrollIntoView({ block: "start" }));
    else await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await expectNothingBetrayed(page, runRoot);
    const mask = pathElements(page, runRoot);
    photographs.push({
      png: await page.screenshot({ mask, maskColor: MASK_COLOR }),
      // The same screen again, for the WebM: see writeWebm.
      jpeg: await page.screenshot({ mask, maskColor: MASK_COLOR, type: "jpeg", quality: 90 }),
      holdMs,
    });
  }

  try {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await page.goto(`http://127.0.0.1:${address.port}/#token=${encodeURIComponent(server.accessToken)}`);
    await page.getByLabel("Workspace root (cwd)").fill(runRoot);
    await page.getByRole("tab", { name: "Pipeline" }).click();

    // 1. The Pipeline: every change drawn, and the order declared between
    // two of them.
    await expect(page.getByTestId("pipeline-node-tour-export")).toContainText("waiting on tour-parser", { timeout: 15000 });
    await expect(page.getByTestId(`pipeline-node-${CHANGE_NAME}`)).toBeVisible();
    await photograph(3000);

    // 2. Start, on the card.
    const start = page.getByTestId(`pipeline-start-${CHANGE_NAME}`);
    await expect(async () => {
      await readPipelineAgain(page);
      await expect(start).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });
    await start.click();
    const layer = page.getByTestId("pipeline-run-layer");
    const dialog = layer.getByTestId("run-dialog");
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await photograph(2000, dialog);

    // 3. The chain, and its first checkpoint.
    await dialog.getByTestId("run-dialog-path-chain").click();
    const chain = layer.getByTestId("pipeline-run-chain");
    await chain.getByTestId("start-chain-button").click();
    await expect(chain.getByTestId("checkpoint-confirmation")).toBeVisible({ timeout: 15000 });
    await photograph(2500, page.getByTestId(`pipeline-node-${CHANGE_NAME}`));

    // 4. Continue, on the card, at every checkpoint until a stage runs. The
    // stand-in holds verify, where the card offers Stop and no Continue.
    const continueOnCard = page.getByTestId(`pipeline-continue-${CHANGE_NAME}`);
    const stopOnCard = page.getByTestId(`pipeline-stop-${CHANGE_NAME}`);
    await expect(async () => {
      await readPipelineAgain(page);
      await expect(continueOnCard).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });
    await expect(async () => {
      await readPipelineAgain(page);
      if (await continueOnCard.isVisible()) await continueOnCard.click({ timeout: 5000 });
      await expect(continueOnCard).toBeHidden({ timeout: 10000 });
      await expect(stopOnCard).toBeVisible({ timeout: 10000 });
    }).toPass({ timeout: 90000 });
    await photograph(2500, page.getByTestId(`pipeline-node-${CHANGE_NAME}`));

    // 5. Stop, with a reason typed where a reader can watch it.
    await stopOnCard.click();
    const form = page.getByRole("dialog", { name: `Ask ${CHANGE_NAME} to stop` });
    await expect(form).toBeVisible();
    const reason = form.getByTestId("pipeline-stop-reason");
    for (const typed of ["wrong", "wrong bran", "wrong branch"]) {
      await reason.fill(typed);
      await expect(reason).toHaveValue(typed);
      await photograph(typed === "wrong branch" ? 1500 : 200, page.getByTestId(`pipeline-node-${CHANGE_NAME}`));
    }
    await form.getByTestId("pipeline-ask-to-stop").click();
    await expect(form).toBeHidden();

    // 6. The card states the request, from the run's record.
    const card = page.getByTestId(`pipeline-node-${CHANGE_NAME}`);
    await expect(card).toContainText("asked to stop", { timeout: 15000 });
    await expect(card).toContainText("wrong branch");
    await expect(card).toContainText("by fixture@example.com");
    await photograph(4000, page.getByTestId(`pipeline-node-${CHANGE_NAME}`));

    expect(pageErrors).toEqual([]);

    // The recording, written only if it is within what the README and the
    // site can carry.
    expect(problemsWith(photographs)).toEqual([]);
    // Looking at every photograph is a check nothing else can make (tasks
    // 4.3 of a-tour-is-recorded): TOUR_KEEP_FRAMES=<directory> keeps them.
    const keepFrames = process.env.TOUR_KEEP_FRAMES;
    if (keepFrames) {
      await mkdir(keepFrames, { recursive: true });
      for (const [index, item] of photographs.entries()) {
        await writeFile(path.join(keepFrames, `frame-${String(index + 1).padStart(2, "0")}.jpg`), item.jpeg);
      }
    }
    const gifBytes = await writeGif(photographs, path.join(IMAGES_DIR, "tour.gif"));
    expect(gifBytes, "tour.gif is too heavy for the README").toBeLessThanOrEqual(LIMITS.gifBytes);
    const webmBytes = await writeWebm(photographs, path.join(IMAGES_DIR, "tour.webm"));
    expect(webmBytes, "tour.webm is too heavy for the site").toBeLessThanOrEqual(LIMITS.webmBytes);
    expect((await stat(path.join(IMAGES_DIR, "tour.gif"))).size).toBe(gifBytes);
  } finally {
    releaseVerify();
    await socket.current?.close();
    await server.close();
    await rm(runRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(() => undefined);
  }
});
