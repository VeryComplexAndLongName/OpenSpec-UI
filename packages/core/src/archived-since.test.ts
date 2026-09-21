import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readArchivedSince } from "./archived-since.js";
import { createGitWrapper } from "./git.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";

// a-change-is-archived-with-nothing-open 3.5. Real git: what a pull request
// archives is what its tree has under the archive that its base does not.
//
// every-varying-check-has-a-budget: real git processes against a
// temporary repository, whose time varies with the machine and its load.
vi.setConfig({ testTimeout: 60_000 });

const run = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
});

async function git(cwd: string, args: string[]): Promise<string> {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.com",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.com",
  };
  const { stdout } = await run("git", [...(await gitIsolationArgs()), ...args], { cwd, env });
  return stdout;
}

async function archive(root: string, name: string, tasks: string): Promise<void> {
  const directory = path.join(root, "openspec", "changes", "archive", name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "tasks.md"), tasks, "utf8");
}

/** A repository whose `main` already holds one archived change, and a
 * branch that archives two more on top. */
async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-archived-since-"));
  roots.push(root);
  await git(root, ["init", "-q", "-b", "main"]);
  await archive(root, "2026-09-19-old-and-open", "- [ ] 1.1 Left open long ago.\n");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-q", "-m", "an old archive"]);
  await git(root, ["checkout", "-q", "-b", "the-sweep"]);
  await archive(root, "2026-09-21-finished", "- [x] 1.1 Done.\n");
  await archive(root, "2026-09-21-unfinished", "- [x] 1.1 Done.\n- [ ] 5.6 **Human-only.** The live sweep.\n");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-q", "-m", "the sweep"]);
  return root;
}

describe("what a pull request archives", () => {
  it("finds the archives this branch adds, and what each still owes", async () => {
    const root = await repository();

    const found = await readArchivedSince(root, "main", createGitWrapper({ cwd: root }));

    expect(found.map((one) => one.archiveName)).toEqual(["2026-09-21-finished", "2026-09-21-unfinished"]);
    expect(found.find((one) => one.archiveName === "2026-09-21-finished")?.debts.open).toEqual([]);
    expect(found.find((one) => one.archiveName === "2026-09-21-unfinished")?.debts.open.join(" ")).toContain("5.6");
  });

  it("does not read an archive already on the base, however it stands", async () => {
    const root = await repository();

    const found = await readArchivedSince(root, "main", createGitWrapper({ cwd: root }));

    expect(found.map((one) => one.archiveName)).not.toContain("2026-09-19-old-and-open");
  });

  it("fails where the base cannot be read, rather than finding nothing", async () => {
    const root = await repository();

    await expect(readArchivedSince(root, "origin/no-such-branch", createGitWrapper({ cwd: root }))).rejects.toThrow();
  });
});
