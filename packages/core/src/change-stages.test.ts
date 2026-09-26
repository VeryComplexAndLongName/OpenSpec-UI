import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangeHistory } from "./change-history.js";
import type { ChangeStanding } from "./change-standing-facts.js";
import { readChangeStage, readChangeStages } from "./change-stages.js";
import { getAddedFileDates } from "./change-timeline.js";
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

  // a-change-before-its-proposal (ADR 0037, amended 2026-09-25).
  it("reads a change made before its proposal as Drafted, dated by its directory's first commit", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-stages-"));
    roots.push(root);
    await git(root, ["init", "-q", "-b", "main"]);
    await commitFile(root, "openspec/changes/new-idea/.openspec.yaml", "schema: spec-driven\n", at(1));

    const draft = await readChangeStage(root, "new-idea", { history: { ...noHistory, changeName: "new-idea" }, now: () => new Date(at(3)) });

    expect(draft.stage).toBe("drafted");
    expect(draft.since).toBe(at(1));
    expect(draft.totals).toEqual([{ stage: "drafted", visits: 1, ms: 2 * 3600_000 }]);

    await commitFile(root, "openspec/changes/new-idea/proposal.md", "## Why\n", at(2));
    const proposed = await readChangeStage(root, "new-idea", { history: { ...noHistory, changeName: "new-idea" } });

    expect(proposed.stage).toBe("proposed");
    expect(proposed.visits.map((visit) => visit.stage)).toEqual(["drafted", "proposed"]);
  });

  it("gives a change committed with its proposal no Drafted visit", async () => {
    const root = await repository();

    const reading = await readChangeStage(root, "demo", { history: noHistory });

    expect(reading.visits[0]?.stage).toBe("proposed");
  });

  it("lists a draft among a working tree's changes, and not a leftover of an archived change", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-stages-"));
    roots.push(root);
    await git(root, ["init", "-q", "-b", "main"]);
    await commitFile(root, "openspec/changes/new-idea/.openspec.yaml", "schema: spec-driven\n", at(1));
    await commitFile(root, "openspec/changes/shipped/harness.json", "{}\n", at(1));
    await commitFile(root, "openspec/changes/archive/2026-09-20-shipped/proposal.md", "## Why\n", at(1));

    const readings = await readChangeStages(root);

    expect(readings.map((one) => [one.changeName, one.stage])).toEqual([["new-idea", "drafted"]]);
  });

  // the-board-reads-quickly: one reading of the tree's additions, and the
  // same dates as asking git about each file.
  it("dates a working tree's changes from one reading of its additions, as it did file by file", async () => {
    const root = await repository();
    await commitFile(root, "openspec/changes/second/proposal.md", "## Why\n", at(5));

    const added = await getAddedFileDates(root, "openspec/changes");
    const all = await readChangeStages(root);
    const alone = await readChangeStage(root, "demo", { history: noHistory });

    expect(new Date(added.get("openspec/changes/demo/proposal.md") as string).toISOString()).toBe(at(1));
    expect(new Date(added.get("openspec/changes/demo/tasks.md") as string).toISOString()).toBe(at(2));
    expect(all.find((one) => one.changeName === "demo")?.visits).toEqual(alone.visits);
    expect(all.find((one) => one.changeName === "second")?.stage).toBe("proposed");
  });

  it("still dates a proposal renamed into place from its first commit", async () => {
    const root = await repository();
    await git(root, ["mv", "openspec/changes/demo", "openspec/changes/renamed"]);
    await git(root, ["commit", "-q", "-m", "rename"], at(6));

    const [renamed] = await readChangeStages(root);

    expect(renamed?.changeName).toBe("renamed");
    expect(renamed?.visits[0]).toMatchObject({ stage: "proposed", from: at(1) });
  });
});
