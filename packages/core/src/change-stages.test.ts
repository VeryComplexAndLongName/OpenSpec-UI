import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangeHistory } from "./change-history.js";
import type { ChangeStanding } from "./change-standing-facts.js";
import { readChangeStage } from "./change-stages.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";

// a-change-knows-its-stage: real git, with commits at the times a test
// names, since the stages are read from commit dates and `git blame`.
//
// every-varying-check-has-a-budget: a handful of git processes against a
// temporary repository. Measured on 2026-09-22: under 3 s on this machine.
vi.setConfig({ testTimeout: 60_000 });

const run = promisify(execFile);
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
});

const at = (hour: number) => new Date(Date.UTC(2026, 8, 22, hour)).toISOString();

async function git(cwd: string, args: string[], when?: string): Promise<string> {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.com",
    GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.com",
    ...(when !== undefined ? { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } : {}),
  };
  const { stdout } = await run("git", [...(await gitIsolationArgs()), ...args], { cwd, env });
  return stdout;
}

async function commitFile(root: string, file: string, text: string, when: string): Promise<void> {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), text, "utf8");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-q", "-m", file], when);
}

/** A change proposed at 1, planned at 2, its first task closed at 4. */
async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-stages-"));
  roots.push(root);
  await git(root, ["init", "-q", "-b", "main"]);
  const change = "openspec/changes/demo";
  await commitFile(root, `${change}/proposal.md`, "## Why\n\nBecause.\n", at(1));
  await commitFile(root, `${change}/tasks.md`, "## 1. Work\n\n- [ ] 1.1 First\n- [ ] 1.2 Second\n", at(2));
  await commitFile(root, `${change}/tasks.md`, "## 1. Work\n\n- [x] 1.1 First\n- [ ] 1.2 Second\n", at(4));
  return root;
}

const noHistory: ChangeHistory = { changeName: "demo", entries: [], roles: {}, problems: [] };

describe("reading a change's stages", () => {
  it("dates each stage from its commit, its closed task and its pull request", async () => {
    const root = await repository();
    const standing: ChangeStanding = { changeName: "demo", elsewhere: [], pullRequest: { number: 12, state: "OPEN", createdAt: at(6) } };

    const reading = await readChangeStage(root, "demo", { standing, history: noHistory, now: () => new Date(at(10)) });

    expect(reading.stage).toBe("in-review");
    expect(reading.since).toBe(at(6));
    expect(reading.visits.map((one) => [one.stage, one.from, one.enteredBy.what])).toEqual([
      ["proposed", at(1), "proposal.md committed"],
      ["planned", at(2), "tasks.md committed"],
      ["in-progress", at(4), "closed 1.1"],
      ["in-review", at(6), "#12 opened"],
    ]);
    expect(reading.totals.find((one) => one.stage === "in-review")?.ms).toBe(4 * 3_600_000);
  });

  it("goes back where the history sends it, and lands on a merge", async () => {
    const root = await repository();
    const history: ChangeHistory = {
      changeName: "demo",
      roles: { owner: "ada", implementer: "bob" },
      problems: [],
      entries: [{
        file: "x.json", signature: "verified", keyId: "k", handle: "ada",
        event: { version: 1, change: "demo", at: at(7), by: { handle: "ada", keyId: "k" }, actor: { kind: "person" }, type: "sent-back", toStage: "in-progress", reason: "a gap", reopened: [] },
      }],
    };
    const standing: ChangeStanding = { changeName: "demo", elsewhere: [], pullRequest: { number: 12, state: "MERGED", createdAt: at(6), mergedAt: at(9) } };

    const reading = await readChangeStage(root, "demo", { standing, history, runTimes: [at(8)], now: () => new Date(at(10)) });

    expect(reading.visits.map((one) => one.stage)).toEqual(["proposed", "planned", "in-progress", "in-review", "in-progress", "landed"]);
    expect(reading.stage).toBe("landed");
    expect(reading.roles).toEqual({ owner: "ada", implementer: "bob" });
    expect(reading.totals.find((one) => one.stage === "in-progress")).toMatchObject({ visits: 2, ms: (2 + 2) * 3_600_000 });
  });

  it("reads a pushed commit on the change's branch as a new version for review", async () => {
    const root = await repository();
    await git(root, ["checkout", "-q", "-b", "demo"]);
    await commitFile(root, "src.txt", "one\n", at(8));
    await git(root, ["checkout", "-q", "main"]);
    const standing: ChangeStanding = {
      changeName: "demo", elsewhere: [],
      branch: { name: "demo", local: true, remote: false },
      pullRequest: { number: 12, state: "OPEN", createdAt: at(6) },
    };
    const history: ChangeHistory = {
      ...noHistory,
      entries: [{
        file: "x.json", signature: "verified", keyId: "k", handle: "ada",
        event: { version: 1, change: "demo", at: at(7), by: { handle: "ada", keyId: "k" }, actor: { kind: "person" }, type: "sent-back", toStage: "in-progress", reason: "a gap", reopened: [] },
      }],
    };

    const reading = await readChangeStage(root, "demo", { standing, history, defaultBranch: "main", remote: "nowhere", now: () => new Date(at(10)) });

    // "nowhere/main" is not a ref, so nothing is read from the branch: the
    // change stays where it was sent.
    expect(reading.stage).toBe("in-progress");

    const readingOnMain = await readChangeStage(root, "demo", {
      standing, history, now: () => new Date(at(10)),
      git: { commitTimesBetween: async () => [at(8)] },
    });
    expect(readingOnMain.stage).toBe("in-review");
    expect(readingOnMain.since).toBe(at(8));
  });

  it("reads a stage from the files where nothing is committed yet", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-stages-"));
    roots.push(root);
    await git(root, ["init", "-q", "-b", "main"]);
    await mkdir(path.join(root, "openspec", "changes", "draft"), { recursive: true });
    await writeFile(path.join(root, "openspec", "changes", "draft", "proposal.md"), "## Why\n", "utf8");
    await writeFile(path.join(root, "openspec", "changes", "draft", "tasks.md"), "- [ ] 1.1 One\n", "utf8");

    const reading = await readChangeStage(root, "draft", { history: { ...noHistory, changeName: "draft" } });

    expect(reading.stage).toBe("planned");
    expect(reading.visits).toEqual([]);
  });
});
