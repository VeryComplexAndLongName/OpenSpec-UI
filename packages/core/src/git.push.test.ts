import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import simpleGit from "simple-git";
import { afterAll, describe, expect, it } from "vitest";
import { createGitWrapper } from "./git.js";

// No raised timeout here, deliberately. This file takes ~2.6 s alone and
// hangs past 20 s beside another worker on Windows, because Git for
// Windows' MSYS/Cygwin fork-emulation races when the ~8 real `git`
// subprocesses this file spawns run concurrently with another worker's
// (or, over a long run, a prior file's) own git subprocesses — not because
// the test is slow. A ceiling would only change which number the failure
// reports. This is why this file runs isolated in its own single-fork
// vitest project (see ../vitest.workspace.ts) instead of sharing a worker
// with the rest of packages/core. Tracked as core-test-worker-contention.
const temporaryRoots: string[] = [];

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

// afterAll, not afterEach: the git processes holding these directories
// have exited by then, which is what stops the `EBUSY: resource busy or
// locked, rmdir` failures — the same fix git-fixture-test-cost applied to
// change-timeline.test.ts and sprint-report.test.ts.
afterAll(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function commitAll(repoRoot: string, message: string, isoDate: string): Promise<void> {
  const git = simpleGit(repoRoot).env({
    GIT_AUTHOR_NAME: "Test User",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test User",
    GIT_COMMITTER_EMAIL: "test@example.com",
    GIT_AUTHOR_DATE: isoDate,
    GIT_COMMITTER_DATE: isoDate,
  });
  await git.add(".");
  await git.commit(message);
}

describe("createGitWrapper.push", () => {
  it("pushes a branch that has no upstream yet", async () => {
    const remoteRoot = await temporaryRoot("openspec-git-remote-");
    const repoRoot = await temporaryRoot("openspec-git-local-");

    await simpleGit(remoteRoot).init(true);

    const localGit = simpleGit(repoRoot);
    await localGit.init();
    await localGit.raw(["branch", "-M", "main"]);
    await localGit.addRemote("origin", remoteRoot);

    await writeFile(path.join(repoRoot, "README.md"), "v1\n", "utf8");
    await commitAll(repoRoot, "initial", "2026-09-02T12:00:00Z");

    // Deliberately no `push -u` first. The git stage pushes a branch it
    // has just built, which has no upstream, and a bare `git push` fails
    // outright there — the reason `push()` takes its target explicitly.
    const wrapper = createGitWrapper({ cwd: repoRoot });
    await wrapper.push("origin", "main");

    const localHead = (await localGit.raw(["rev-parse", "HEAD"])).trim();
    const remoteHead = (await simpleGit(remoteRoot).raw(["rev-parse", "refs/heads/main"])).trim();
    expect(remoteHead).toBe(localHead);
  });
});
