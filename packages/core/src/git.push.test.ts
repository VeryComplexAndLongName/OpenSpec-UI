import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createGitWrapper, prepareSingleRefPush } from "./git.js";
import { gitIsolationOptions } from "./test-support/git-isolation.js";

// This file used to carry no timeout deliberately, and the reason still
// matters: it does not stall because it is slow. On Windows, Git for
// Windows' MSYS/Cygwin fork-emulation races when the ~8 real `git`
// subprocesses this file spawns run concurrently with another worker's
// own, and a ceiling would only have changed which number that failure
// reported. `core-test-worker-contention` fixed that by giving this file
// its own single-fork vitest project (see ../vitest.workspace.ts), not by
// widening anything.
//
// every-varying-check-has-a-budget: with that isolation in place, what
// remains is ordinary slowness. Measured 2026-09-05, this file alone at
// 2.2s idle and 13.1s for its slowest single test under deliberate
// 8-worker CPU co-load — proportionate, and passing, where the 5000 ms
// default would not have cleared it. So the budget below is sized from
// the loaded figure. If this file ever stalls again rather than slowing,
// the paragraph above is the one that applies, and the remedy is not a
// bigger number here.
vi.setConfig({ testTimeout: 45_000 });

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
  // Isolated from the machine's git configuration — see
  // test-support/git-isolation.ts.
  const git = simpleGit(repoRoot, await gitIsolationOptions()).env({
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

describe("prepareSingleRefPush", () => {
  it("updates only the pinned ref and refuses multiple push URLs or mirror mode", async () => {
    const repo = await temporaryRoot("openspec-approved-push-");
    const first = await temporaryRoot("openspec-approved-first-");
    const second = await temporaryRoot("openspec-approved-second-");
    const isolated = await gitIsolationOptions();
    const local = simpleGit(repo, { ...isolated, unsafe: { ...isolated.unsafe, allowUnsafeUrlRewrite: true } });
    const firstRemote = simpleGit(first, isolated);
    const secondRemote = simpleGit(second, isolated);
    await firstRemote.init(true);
    await secondRemote.init(true);
    await local.init();
    await local.raw(["branch", "-M", "feature"]);
    await local.addRemote("origin", first);
    await writeFile(path.join(repo, "README.md"), "one\n", "utf8");
    await commitAll(repo, "first", "2026-11-09T00:00:00Z");
    await local.raw(["-c", "user.name=Test", "-c", "user.email=test@example.com", "tag", "-a", "extra", "-m", "extra"]);
    await local.raw(["config", "push.followTags", "true"]);
    await local.raw(["config", "push.recurseSubmodules", "only"]);
    await local.raw(["config", "push.pushOption", "must-not-send"]);

    const push = await prepareSingleRefPush(repo, "origin", "feature");
    expect(push.approval).toMatchObject({
      commit: (await local.raw(["rev-parse", "HEAD"])).trim(),
      destinationRef: "refs/heads/feature",
      remote: "origin",
    });
    await local.raw(["remote", "set-url", "origin", second]);
    await local.raw(["config", `url.${second}.insteadOf`, push.endpoint]);
    await writeFile(path.join(repo, "README.md"), "two\n", "utf8");
    await commitAll(repo, "second", "2026-11-09T00:01:00Z");
    await push.push();
    expect((await firstRemote.raw(["show-ref"])).trim()).toBe(`${push.approval.commit} refs/heads/feature`);
    expect(await secondRemote.raw(["for-each-ref"])).toBe("");

    await local.raw(["config", "--add", "remote.origin.pushurl", first]);
    await local.raw(["config", "--add", "remote.origin.pushurl", second]);
    await expect(prepareSingleRefPush(repo, "origin", "feature")).rejects.toThrow(/single non-mirror/);
    await local.raw(["config", "--unset-all", "remote.origin.pushurl"]);
    await local.raw(["config", "remote.origin.mirror", "true"]);
    await expect(prepareSingleRefPush(repo, "origin", "feature")).rejects.toThrow(/single non-mirror/);
  });
});

describe("createGitWrapper.push", () => {
  it("pushes a branch that has no upstream yet", async () => {
    const remoteRoot = await temporaryRoot("openspec-git-remote-");
    const repoRoot = await temporaryRoot("openspec-git-local-");

    const isolated = await gitIsolationOptions();
    await simpleGit(remoteRoot, isolated).init(true);

    const localGit = simpleGit(repoRoot, isolated);
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
    const remoteHead = (await simpleGit(remoteRoot, isolated).raw(["rev-parse", "refs/heads/main"])).trim();
    expect(remoteHead).toBe(localHead);
  });
});
