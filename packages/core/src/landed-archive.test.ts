import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PENDING_REASON, type BranchPullRequest, type Forge, type MergeMethod, type PullRequestCheckStatus } from "./gh-pr-gateway.js";
import { createGitWrapper } from "./git.js";
import { archiveLandedChanges, describeLandedArchive, LANDED_ARCHIVE_BRANCH_PREFIX, landedArchiveTitle, type LandedArchiveDeps } from "./landed-archive.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";
import { ARCHIVE_CLAIM, createArchiveFollower, describeWorkspaceSweep, sweepWorkspace, type WorkspaceSweep } from "./workspace-sweep.js";
import { claimDirectoryBeside, releaseClaim, takeClaim } from "./resource-claim.js";
import { resolveAgentStatusDirectory } from "./agent-status.js";

// ADR 0035, a-landed-change-is-archived-for-you. Real git against a bare
// remote, because what is asserted is what reaches the server: one branch
// holding every finished change's archive, and nothing for a change that
// still owes something or is still being worked on. The forge and
// `openspec archive` are seams: the first is a server, the second a CLI a
// runner does not have.
//
// every-varying-check-has-a-budget: real git processes, pushes through a
// local remote included, whose time varies with the machine and its load.
vi.setConfig({ testTimeout: 90_000 });

const run = promisify(execFile);
const roots: string[] = [];
const NL = String.fromCharCode(10);

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
});

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", [...(await gitIsolationArgs()), ...args], { cwd });
  return stdout.trim();
}

async function write(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

const DONE = ["## 1. Work", "", "- [x] 1.1 Did it", ""].join(NL);
const OPEN = ["## 1. Work", "", "- [x] 1.1 Did it", "- [ ] 1.2 Not yet", ""].join(NL);

interface Fixture { root: string; work: string; remote: string }

/** A bare remote and a main checkout whose default branch holds the
 * given changes, each with the given task list. */
async function landed(changes: Record<string, string>): Promise<Fixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-landed-"));
  roots.push(root);
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  await git(root, ["init", "-q", "--bare", "-b", "main", remote]);
  await mkdir(work);
  await git(work, ["init", "-q", "-b", "main"]);
  // The pass commits through the product's own git, so the identity lives
  // in the repository: a runner has no global one.
  await git(work, ["config", "user.name", "Fixture"]);
  await git(work, ["config", "user.email", "fixture@example.com"]);
  await git(work, ["remote", "add", "origin", remote]);
  for (const [name, tasks] of Object.entries(changes)) {
    await write(path.join(work, "openspec", "changes", name, "proposal.md"), ["## Why", "", "Because.", ""].join(NL));
    await write(path.join(work, "openspec", "changes", name, "tasks.md"), tasks);
  }
  await write(path.join(work, "README.md"), "fixture" + NL);
  await git(work, ["add", "."]);
  await git(work, ["commit", "-q", "-m", "changes"]);
  await git(work, ["push", "-q", "-u", "origin", "main"]);
  return { root, work, remote };
}

/** What `openspec archive` does to the tree, without the CLI. */
async function fakeArchive(changeName: string, directoryPath: string): Promise<void> {
  const from = path.join(directoryPath, "openspec", "changes", changeName);
  const to = path.join(directoryPath, "openspec", "changes", "archive", `2026-09-21-${changeName}`);
  await mkdir(path.dirname(to), { recursive: true });
  await rename(from, to);
}

type FakeForge = Forge & { opened: Array<{ head: string; title: string; body: string }>; merged: Array<[number, MergeMethod]> };

interface FakeForgeBehaviour {
  checks?: PullRequestCheckStatus;
  /** Refuses a merge by each of these methods, with this reason. */
  refuse?: Partial<Record<MergeMethod, string>>;
  onMerge?: () => Promise<void>;
}

function fakeForge(byBranch: Record<string, BranchPullRequest> = {}, behaviour: FakeForgeBehaviour = {}): FakeForge {
  const opened: Array<{ head: string; title: string; body: string }> = [];
  const merged: Array<[number, MergeMethod]> = [];
  return {
    name: "TestForge",
    opened,
    merged,
    pullRequestsByBranch: vi.fn(async () => ({ available: true as const, byBranch: new Map(Object.entries(byBranch)) })),
    openPullRequest: vi.fn(async (request: { head: string; base: string; title: string; body: string }) => {
      opened.push(request);
      return { number: 700, url: "https://example.test/pull/700" };
    }),
    checksOf: vi.fn(async () => behaviour.checks ?? { state: "pass" as const }),
    mergeNow: vi.fn(async (prNumber: number, method: MergeMethod = "merge") => {
      const refused = behaviour.refuse?.[method];
      if (refused !== undefined) throw new Error(refused);
      merged.push([prNumber, method]);
      await behaviour.onMerge?.();
    }),
  };
}

const OPEN_ARCHIVE = `${LANDED_ARCHIVE_BRANCH_PREFIX}2026-09-20-101010`;

function depsFor(fixture: Fixture, forge: Forge, overrides: Partial<LandedArchiveDeps> = {}): LandedArchiveDeps {
  return {
    git: createGitWrapper({ cwd: fixture.work }),
    gitIn: (directoryPath) => createGitWrapper({ cwd: directoryPath }),
    forge,
    archive: fakeArchive,
    allowed: async () => true,
    makeDirectory: async () => {
      const parent = await mkdtemp(path.join(fixture.root, "pass-"));
      return { path: path.join(parent, "tree"), remove: () => rm(parent, { recursive: true, force: true }) };
    },
    now: () => new Date("2026-09-21T12:34:56Z"),
    ...overrides,
  };
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then(() => true, () => false);
}

describe("archiveLandedChanges", () => {
  it("archives every change that landed with nothing open, in one pull request", async () => {
    const fixture = await landed({ "first-done": DONE, "second-done": DONE, "still-open": OPEN, "in-review": DONE });
    const forge = fakeForge({ "in-review": { number: 12, state: "OPEN" } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.due).toEqual(["first-done", "second-done"]);
    expect(result.opened?.changes).toEqual(["first-done", "second-done"]);
    expect(result.opened?.branch).toBe(`${LANDED_ARCHIVE_BRANCH_PREFIX}2026-09-21-123456`);
    // Its checks are read from the next pass on: a moment after opening, a
    // forge may not yet have started them (ADR 0036).
    expect(forge.checksOf).not.toHaveBeenCalled();
    expect(forge.merged).toEqual([]);
    // What reached the server: the two moved, the other two where they were.
    const onServer = await git(fixture.remote, ["ls-tree", "-r", "--name-only", result.opened!.branch, "openspec/changes"]);
    expect(onServer).toContain("openspec/changes/archive/2026-09-21-first-done/tasks.md");
    expect(onServer).toContain("openspec/changes/archive/2026-09-21-second-done/tasks.md");
    expect(onServer).toContain("openspec/changes/still-open/tasks.md");
    expect(onServer).toContain("openspec/changes/in-review/tasks.md");
    expect(onServer).not.toContain("openspec/changes/first-done/");
    // Nothing of the pass is left on this machine.
    expect(await git(fixture.work, ["branch", "--list", `${LANDED_ARCHIVE_BRANCH_PREFIX}*`])).toBe("");
    expect((await git(fixture.work, ["worktree", "list"])).split(NL)).toHaveLength(1);
    expect(forge.opened[0]?.body).toContain("`first-done`");
  });

  it("asks the forge nothing where no change could be finished", async () => {
    const fixture = await landed({});
    const forge = fakeForge();

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result).toEqual({ due: [], notArchived: [], owing: [] });
    expect(forge.pullRequestsByBranch).not.toHaveBeenCalled();
  });

  // the-sweep-finishes-the-archive-it-opened. Once the changes an open
  // archive pull request held are archived by another, there is nothing
  // left to archive - and the pass used to return before it ever looked at
  // the open one again, which is how #729 sat for an hour.
  it("comes back for an archive pull request of ours even with nothing left to archive", async () => {
    const fixture = await landed({});
    await git(fixture.work, ["push", "-q", "origin", `main:${OPEN_ARCHIVE}`]);
    await git(fixture.work, ["fetch", "-q", "--prune", "origin"]);
    const forge = fakeForge({ [OPEN_ARCHIVE]: { number: 729, state: "OPEN" } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(forge.pullRequestsByBranch).toHaveBeenCalled();
    expect(result.followed?.number).toBe(729);
    expect(forge.merged).toEqual([[729, "squash"]]);
  });

  it("still asks the forge nothing where no archive branch of ours is on the server", async () => {
    const fixture = await landed({});
    const forge = fakeForge({ "somebody-elses-branch": { number: 5, state: "OPEN" } });

    await archiveLandedChanges(depsFor(fixture, forge));

    expect(forge.pullRequestsByBranch).not.toHaveBeenCalled();
  });

  it("waits while an open archive pull request's checks are running, and opens no other", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge = fakeForge({ [OPEN_ARCHIVE]: { number: 650, state: "OPEN" } }, { checks: { state: "none", reason: PENDING_REASON } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.followed).toEqual({ branch: OPEN_ARCHIVE, number: 650, outcome: { state: "waiting" } });
    expect(forge.openPullRequest).not.toHaveBeenCalled();
    expect(forge.merged).toEqual([]);
    expect(describeLandedArchive(result)).toEqual(["#650 is waiting for its checks"]);
  });

  it("merges an open archive pull request itself once its checks pass, by squash", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge = fakeForge({ [OPEN_ARCHIVE]: { number: 650, state: "OPEN" } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.followed?.outcome).toEqual({ state: "merged", method: "squash" });
    expect(forge.merged).toEqual([[650, "squash"]]);
    expect(forge.openPullRequest).not.toHaveBeenCalled();
    expect(describeLandedArchive(result)).toEqual(["merged #650 by squash: its checks passed, or none ran"]);
  });

  it("merges where no check ran, since an archive only moves what openspec archive wrote", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge = fakeForge({ [OPEN_ARCHIVE]: { number: 650, state: "OPEN" } }, { checks: { state: "none", reason: "no check result was available" } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.followed?.outcome).toEqual({ state: "merged", method: "squash" });
  });

  it("merges by another method where the repository does not allow squash", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge = fakeForge({ [OPEN_ARCHIVE]: { number: 650, state: "OPEN" } }, { refuse: { squash: "Squash merges are not allowed on this repository." } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.followed?.outcome).toEqual({ state: "merged", method: "merge" });
    expect(forge.merged).toEqual([[650, "merge"]]);
  });

  it("does not merge where a check failed, and says which", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge = fakeForge({ [OPEN_ARCHIVE]: { number: 650, state: "OPEN" } }, { checks: { state: "fail", reason: "check failed: build (failure)" } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.followed?.outcome).toEqual({ state: "blocked", reason: "check failed: build (failure)", cause: "check-failed" });
    expect(forge.mergeNow).not.toHaveBeenCalled();
    expect(describeLandedArchive(result)).toEqual(["#650 cannot merge yet: check failed: build (failure)"]);
  });

  it("says the forge's own reason where it refuses the merge, and tries no other method for it", async () => {
    const fixture = await landed({ "first-done": DONE });
    const refusal = "At least 1 approving review is required by reviewers with write access.";
    const forge = fakeForge({ [OPEN_ARCHIVE]: { number: 650, state: "OPEN" } }, { refuse: { squash: refusal, merge: refusal, rebase: refusal } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.followed?.outcome).toEqual({ state: "blocked", reason: `TestForge refused the merge: ${refusal}`, cause: "refused" });
    expect(forge.mergeNow).toHaveBeenCalledTimes(1);
  });

  // an-archive-keeps-up-with-main: a repository that merges only what is
  // up to date with its default branch refuses an archive once the branch
  // moves on, and would refuse it on every pass after.
  it("makes the archive again on the default branch where the forge refused it and the branch had moved on", async () => {
    const fixture = await landed({ "first-done": DONE });
    const first = await archiveLandedChanges(depsFor(fixture, fakeForge()));
    const branch = first.opened!.branch;
    const before = await git(fixture.remote, ["rev-parse", branch]);
    await landElsewhere(fixture, "landed.txt");
    await git(fixture.work, ["fetch", "-q", "origin"]);
    const behindRefusal = "Head branch is not up to date with the base branch";
    const forge = fakeForge({ [branch]: { number: 700, state: "OPEN" } }, { refuse: { squash: behindRefusal, merge: behindRefusal, rebase: behindRefusal } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.followed?.outcome).toEqual({ state: "rebuilt", behind: 1 });
    const after = await git(fixture.remote, ["rev-parse", branch]);
    expect(after).not.toBe(before);
    // On the default branch as it is now, still archiving the change.
    await git(fixture.remote, ["merge-base", "--is-ancestor", "main", branch]);
    const onServer = await git(fixture.remote, ["ls-tree", "-r", "--name-only", branch]);
    expect(onServer).toContain("landed.txt");
    expect(onServer).toContain("openspec/changes/archive/2026-09-21-first-done/tasks.md");
    expect(forge.openPullRequest).not.toHaveBeenCalled();
    expect(describeLandedArchive(result)).toEqual([
      "#700 was refused while 1 commit behind the default branch, so the archive was made again on it and pushed; its checks run again",
    ]);
    // Nothing of the pass is left on this machine.
    expect(await git(fixture.work, ["branch", "--list", `${LANDED_ARCHIVE_BRANCH_PREFIX}*`])).toBe("");
  });

  it("leaves a refused archive as it is where the default branch has not moved on", async () => {
    const fixture = await landed({ "first-done": DONE });
    const first = await archiveLandedChanges(depsFor(fixture, fakeForge()));
    const branch = first.opened!.branch;
    const before = await git(fixture.remote, ["rev-parse", branch]);
    const refusal = "At least 1 approving review is required";
    const forge = fakeForge({ [branch]: { number: 700, state: "OPEN" } }, { refuse: { squash: refusal, merge: refusal, rebase: refusal } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.followed?.outcome).toMatchObject({ state: "blocked", cause: "refused" });
    expect(await git(fixture.remote, ["rev-parse", branch])).toBe(before);
  });

  it("never archives a change that landed owing something, and says what it owes", async () => {
    const fixture = await landed({ "landed-owing": OPEN });
    const forge = fakeForge({ "landed-owing": { number: 44, state: "MERGED" } });

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.due).toEqual([]);
    expect(result.owing).toEqual([{ changeName: "landed-owing", pullRequest: 44, owes: ["still open: 1.2 Not yet"] }]);
    expect(describeLandedArchive(result).join(" ")).toContain("landed-owing landed in #44 but still owes an item");
  });

  it("leaves out a change its configuration keeps live", async () => {
    const fixture = await landed({ "kept-live": DONE });
    const forge = fakeForge();

    const result = await archiveLandedChanges(depsFor(fixture, forge, { allowed: async (name) => name !== "kept-live" }));

    expect(result.due).toEqual([]);
    expect(forge.openPullRequest).not.toHaveBeenCalled();
  });

  it("archives the others when one archive fails, and names the one", async () => {
    const fixture = await landed({ breaks: DONE, works: DONE });
    const forge = fakeForge();

    const result = await archiveLandedChanges(depsFor(fixture, forge, {
      archive: async (name, directoryPath) => {
        if (name === "breaks") throw new Error("openspec archive refused: a spec delta does not apply");
        await fakeArchive(name, directoryPath);
      },
    }));

    expect(result.opened?.changes).toEqual(["works"]);
    expect(result.notArchived).toEqual([{ changeName: "breaks", reason: "openspec archive refused: a spec delta does not apply" }]);
  });

  it("says why where the forge cannot be asked", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge: Forge = { ...fakeForge(), pullRequestsByBranch: async () => ({ available: false as const, reason: "gh is not signed in" }) };

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(result.failed).toBe("TestForge could not be asked about pull requests: gh is not signed in");
  });

  it("says what it opened, and that the sweep merges it", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge = fakeForge();

    const result = await archiveLandedChanges(depsFor(fixture, forge));

    expect(describeLandedArchive(result)).toEqual([
      "opened #700 to archive first-done, which landed with nothing open",
      "#700 is merged by the sweep once its checks pass",
    ]);
    expect(forge.opened[0]?.body).toContain("ADR 0036");
  });

  // the-sweep-finishes-what-it-starts: git commits nothing without failing
  // where nothing was staged, and the branch pushed was the default branch
  // under another name.
  it("pushes nothing where archiving changed nothing", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge = fakeForge();

    const result = await archiveLandedChanges(depsFor(fixture, forge, { archive: async () => undefined }));

    expect(result.failed).toBe("archiving changed nothing, so there was nothing to commit");
    expect(forge.openPullRequest).not.toHaveBeenCalled();
    expect(await git(fixture.remote, ["branch", "--list", `${LANDED_ARCHIVE_BRANCH_PREFIX}*`])).toBe("");
  });

  it("removes what it made when the push is refused, and says so", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge = fakeForge();
    let made = "";

    const result = await archiveLandedChanges(depsFor(fixture, forge, {
      gitIn: (directoryPath) => ({
        ...createGitWrapper({ cwd: directoryPath }),
        push: async () => { throw new Error("remote rejected: protected branch"); },
      }),
      makeDirectory: async () => {
        const parent = await mkdtemp(path.join(fixture.root, "pass-"));
        made = parent;
        return { path: path.join(parent, "tree"), remove: () => rm(parent, { recursive: true, force: true }) };
      },
    }));

    expect(result.failed).toBe("remote rejected: protected branch");
    expect(forge.openPullRequest).not.toHaveBeenCalled();
    expect(await exists(made)).toBe(false);
    expect(await git(fixture.work, ["branch", "--list", `${LANDED_ARCHIVE_BRANCH_PREFIX}*`])).toBe("");
  });
});

describe("an archive pull request's title", () => {
  // main-follows-what-landed: "Archive the 4 changes that landed" said
  // nothing of what it archived.
  it("names what it archives", () => {
    expect(landedArchiveTitle(["alpha"])).toBe("Archive alpha");
    expect(landedArchiveTitle(["alpha", "beta"])).toBe("Archive alpha and beta");
    expect(landedArchiveTitle(["alpha", "beta", "gamma", "delta"])).toBe("Archive alpha, beta and 2 more");
  });
});

/** A commit that lands on the remote's default branch from elsewhere, as a
 * merged pull request does. */
async function landElsewhere(fixture: Fixture, file: string): Promise<void> {
  const other = path.join(fixture.root, "elsewhere");
  await git(fixture.root, ["clone", "-q", fixture.remote, other]);
  await git(other, ["config", "user.name", "Fixture"]);
  await git(other, ["config", "user.email", "fixture@example.com"]);
  await write(path.join(other, file), "landed" + NL);
  await git(other, ["add", "."]);
  await git(other, ["commit", "-q", "-m", "landed elsewhere"]);
  await git(other, ["push", "-q", "origin", "main"]);
}

describe("the workspace sweep follows main (main-follows-what-landed)", () => {
  it("brings a clean main up to what landed, and says so", async () => {
    const fixture = await landed({});
    await landElsewhere(fixture, "landed.txt");

    const swept = await sweepWorkspace(fixture.work, { forge: fakeForge(), archive: fakeArchive });

    expect(swept.main).toEqual({ moved: 1 });
    expect(await git(fixture.work, ["rev-parse", "HEAD"])).toBe(await git(fixture.remote, ["rev-parse", "main"]));
    expect(describeWorkspaceSweep(swept)).toContain("brought main up to origin/main: 1 commit that landed");
  });

  it("leaves a main with work in its tree where it is, and says why", async () => {
    const fixture = await landed({});
    await landElsewhere(fixture, "landed.txt");
    await write(path.join(fixture.work, "README.md"), "mine" + NL);

    const swept = await sweepWorkspace(fixture.work, { forge: fakeForge(), archive: fakeArchive });

    expect(swept.main).toMatchObject({ behind: 1 });
    expect(describeWorkspaceSweep(swept).join(" ")).toContain("main is 1 commit behind origin/main and was left there: the working tree is not clean");
  });

  it("leaves main alone where the workspace turns it off", async () => {
    const fixture = await landed({});
    await landElsewhere(fixture, "landed.txt");
    await write(path.join(fixture.work, "openspec", "agent-harness.json"), JSON.stringify({ branches: { followMain: false } }));
    await git(fixture.work, ["add", "."]);
    await git(fixture.work, ["commit", "-q", "-m", "turn it off"]);

    const swept = await sweepWorkspace(fixture.work, { forge: fakeForge(), archive: fakeArchive });

    expect(swept.main).toBeUndefined();
  });
});

describe("the workspace sweep", () => {
  it("archives a finished change where there is no working directory to sweep", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge = fakeForge();

    const swept = await sweepWorkspace(fixture.work, { forge, archive: fakeArchive });

    expect(swept.archive?.opened?.changes).toEqual(["first-done"]);
    expect(describeWorkspaceSweep(swept)).toContain("opened #700 to archive first-done, which landed with nothing open");
  });

  // ADR 0036: the archive this pass merged reaches the checkout in the same
  // pass, not one sweep later.
  it("brings main up to an archive it merged, in the same pass", async () => {
    const fixture = await landed({ "first-done": DONE });
    const forge = fakeForge({ [OPEN_ARCHIVE]: { number: 650, state: "OPEN" } }, {
      onMerge: () => landElsewhere(fixture, "archived.txt"),
    });

    const swept = await sweepWorkspace(fixture.work, { forge, archive: fakeArchive });

    expect(swept.archive?.followed?.outcome).toEqual({ state: "merged", method: "squash" });
    expect(swept.main).toEqual({ moved: 1 });
    expect(await exists(path.join(fixture.work, "archived.txt"))).toBe(true);
  });

  // the-sweep-finishes-the-archive-it-opened. Two hosts sweeping one
  // workspace opened two archive pull requests for the same two changes,
  // 43 seconds apart: each had read the forge before either had pushed.
  it("leaves the archive to the host already doing it, and says who", async () => {
    const fixture = await landed({ "first-done": DONE });
    const claims = claimDirectoryBeside(
      await resolveAgentStatusDirectory(createGitWrapper({ cwd: fixture.work }), fixture.work),
    );
    const held = await takeClaim({ directory: claims, resource: ARCHIVE_CLAIM, holder: "the other host", machine: "a-machine" });
    expect(held.taken).toBe(true);
    const forge = fakeForge();

    const swept = await sweepWorkspace(fixture.work, { forge, archive: fakeArchive });

    expect(swept.archive).toBeUndefined();
    expect(swept.archiveHeldBy).toBe("the other host");
    expect(forge.openPullRequest).not.toHaveBeenCalled();
    expect(describeWorkspaceSweep(swept)).toContain("left the archive to the other host, who is archiving this workspace now");

    // Released, the next pass archives as it always did.
    await releaseClaim(claims, ARCHIVE_CLAIM);
    const again = await sweepWorkspace(fixture.work, { forge, archive: fakeArchive });
    expect(again.archive?.opened?.changes).toEqual(["first-done"]);
  });

  it("leaves a finished change alone where the workspace turns the archive off", async () => {
    const fixture = await landed({ "first-done": DONE });
    await write(path.join(fixture.work, "openspec", "agent-harness.json"), JSON.stringify({ archive: { whenLanded: false } }));
    const forge = fakeForge();

    const swept = await sweepWorkspace(fixture.work, { forge, archive: fakeArchive });

    expect(swept.archive?.due).toEqual([]);
    expect(forge.openPullRequest).not.toHaveBeenCalled();
  });
});

describe("the archive follower (ADR 0036)", () => {
  const open: WorkspaceSweep = { directories: { removed: [], kept: [] }, archive: { due: [], notArchived: [], owing: [], followed: { branch: OPEN_ARCHIVE, number: 650, outcome: { state: "waiting" } } } };
  const merged: WorkspaceSweep = { directories: { removed: [], kept: [] }, archive: { due: [], notArchived: [], owing: [], followed: { branch: OPEN_ARCHIVE, number: 650, outcome: { state: "merged", method: "squash" } } } };

  it("sweeps again while an archive pull request is open, and stops once it has merged", async () => {
    vi.useFakeTimers();
    try {
      const answers = [open, merged];
      const sweep = vi.fn(async () => answers.shift() ?? merged);
      const follower = createArchiveFollower({ sweep, intervalMs: 1000 });

      follower.observe("/repo", open);
      follower.observe("/repo", open);
      await vi.advanceTimersByTimeAsync(1000);
      expect(sweep).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(sweep).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(5000);
      expect(sweep).toHaveBeenCalledTimes(2);
      follower.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does nothing for a sweep that left nothing open", async () => {
    vi.useFakeTimers();
    try {
      const sweep = vi.fn(async () => merged);
      const follower = createArchiveFollower({ sweep, intervalMs: 1000 });

      follower.observe("/repo", merged);
      follower.observe("/repo", { directories: { removed: [], kept: [] } });
      await vi.advanceTimersByTimeAsync(5000);
      expect(sweep).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
