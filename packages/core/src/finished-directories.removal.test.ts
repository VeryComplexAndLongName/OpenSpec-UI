import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGitWrapper } from "./git.js";
import { sweepFinishedDirectories } from "./finished-directories.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";
import type { SurveyedDirectory, WorktreeSurvey } from "./worktree-survey-facts.js";

// git-says-a-working-directory-is-done 5.2. Real git, a real worktree and
// a real link, because the fear this answers is real: every working
// directory on this machine holds `node_modules` as a junction to the
// main checkout's, and a removal that followed one would delete the
// repository's dependencies.
//
// every-varying-check-has-a-budget: real git processes against temporary
// repositories, whose time varies with the machine and its load.
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

/** A repository with one worktree, and a link inside that worktree
 * pointing at a directory the repository keeps. */
async function repositoryWithWorktree(): Promise<{ root: string; work: string; worktree: string; target: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-done-"));
  roots.push(root);
  const work = path.join(root, "work");
  await mkdir(work);
  await git(work, ["init", "-q", "-b", "main"]);
  await writeFile(path.join(work, "a.txt"), "one", "utf8");
  await git(work, ["add", "."]);
  await git(work, ["commit", "-q", "-m", "first"]);

  const worktree = path.join(root, "side");
  await git(work, ["worktree", "add", "-q", "-b", "side", worktree]);

  const target = path.join(root, "shared");
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, "precious.txt"), "do not delete", "utf8");
  // `junction` on Windows, an ordinary directory link elsewhere: the type
  // is ignored where it has no meaning.
  await symlink(target, path.join(worktree, "node_modules"), "junction");

  return { root, work, worktree, target };
}

function surveyOf(work: string, worktree: string): WorktreeSurvey {
  const base = {
    labelDeclared: false,
    isThis: false,
    runs: [],
    readable: true as const,
    changes: [],
    authorDiffers: false,
  };
  const directories: SurveyedDirectory[] = [
    { ...base, path: work, label: "work", isMain: true, branch: "main" },
    { ...base, path: worktree, label: "side", isMain: false, branch: "side" },
  ];
  return { directories, runsElsewhere: [] };
}

/** The real wrapper for the removal, and the reading stubbed: this test
 * is about what deleting does, and there is no server to fetch from. */
function depsFor(work: string) {
  const wrapper = createGitWrapper({ cwd: work });
  return {
    git: {
      fetch: vi.fn(async () => undefined),
      branchUpstreams: vi.fn(async () => [{ branch: "side", upstream: "origin/side", gone: true }]),
      worktreeRemove: (directoryPath: string, options?: { force?: boolean }) =>
        wrapper.worktreeRemove(directoryPath, options),
    },
    isClean: async () => true,
  };
}

describe("removing a working directory that is done with", () => {
  it("takes the worktree and its shell, and leaves what a link points at", async () => {
    const { work, worktree, target } = await repositoryWithWorktree();

    const swept = await sweepFinishedDirectories(surveyOf(work, worktree), depsFor(work));

    expect(swept.removed.map((one) => one.label)).toEqual(["side"]);
    expect(swept.removed[0]?.failed).toBeUndefined();
    expect(existsSync(worktree)).toBe(false);
    // The whole point: the link was unlinked, not followed.
    expect(await readFile(path.join(target, "precious.txt"), "utf8")).toBe("do not delete");
  });

  it("leaves the branch, so nothing is lost where the remote was deleted unmerged", async () => {
    const { work, worktree } = await repositoryWithWorktree();

    await sweepFinishedDirectories(surveyOf(work, worktree), depsFor(work));

    expect(await createGitWrapper({ cwd: work }).branchExists("side")).toBe(true);
  });

  it("leaves a directory holding uncommitted work exactly where it is", async () => {
    const { work, worktree } = await repositoryWithWorktree();
    await writeFile(path.join(worktree, "a.txt"), "changed", "utf8");

    const swept = await sweepFinishedDirectories(surveyOf(work, worktree), {
      ...depsFor(work),
      isClean: async () => false,
    });

    expect(swept.removed).toEqual([]);
    expect(swept.kept.find((one) => one.label === "side")?.reason).toBe("uncommitted-work");
    expect(existsSync(worktree)).toBe(true);
  });
});
