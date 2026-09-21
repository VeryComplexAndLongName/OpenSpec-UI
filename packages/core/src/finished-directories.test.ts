import { describe, expect, it, vi } from "vitest";
import {
  describeFinished,
  describeKept,
  readWorkingDirectoryStates,
  sweepFinishedDirectories,
  type FinishedReason,
  type KeptReason,
} from "./finished-directories.js";
import type { BranchUpstream } from "./git.js";
import type { ChangeStandings } from "./change-standing-facts.js";
import type { SurveyedDirectory, SurveyedRun, WorktreeSurvey } from "./worktree-survey-facts.js";

// git-says-a-working-directory-is-done 5.1: one test per branch of the
// algorithm, in the order the algorithm asks them.

function directory(partial: Partial<Extract<SurveyedDirectory, { readable: true }>> = {}): SurveyedDirectory {
  return {
    path: "/wt/demo",
    label: "demo",
    labelDeclared: false,
    isMain: false,
    isThis: false,
    branch: "demo",
    runs: [],
    readable: true,
    changes: [],
    authorDiffers: false,
    ...partial,
  };
}

const MAIN = directory({ path: "/repo", label: "repo", isMain: true, isThis: true, branch: "main" });

function survey(directories: SurveyedDirectory[]): WorktreeSurvey {
  return { directories: [MAIN, ...directories], runsElsewhere: [] };
}

function run(): SurveyedRun {
  return {
    instanceId: "i1",
    changeName: "demo",
    stage: null,
    activity: "working",
    activitySinceMs: 0,
    heartbeatAgeMs: 0,
    activityAt: "2026-09-20T12:00:00.000Z",
    heartbeatAt: "2026-09-20T12:00:00.000Z",
    gone: false,
    workingDirectory: "/wt/demo",
    runId: null,
    waiting: null,
    signature: "unverified",
  };
}

const PUSHED: BranchUpstream = { branch: "demo", upstream: "origin/demo", gone: false };
const GONE: BranchUpstream = { branch: "demo", upstream: "origin/demo", gone: true };
const NEVER_PUSHED: BranchUpstream = { branch: "demo", gone: false };

async function states(options: {
  directories?: SurveyedDirectory[];
  upstreams?: BranchUpstream[];
  standings?: ChangeStandings;
  clean?: boolean;
}) {
  return readWorkingDirectoryStates({
    survey: survey(options.directories ?? [directory()]),
    ...(options.upstreams !== undefined ? { upstreams: options.upstreams } : {}),
    ...(options.standings !== undefined ? { standings: options.standings } : {}),
    isClean: async () => options.clean ?? true,
  });
}

const keptReason = (result: Awaited<ReturnType<typeof states>>, label = "demo"): KeptReason | undefined =>
  result.kept.find((one) => one.label === label)?.reason;
const finishedReason = (result: Awaited<ReturnType<typeof states>>, label = "demo"): FinishedReason | undefined =>
  result.finished.find((one) => one.label === label)?.reason;

describe("which working directories are done with", () => {
  it("keeps the main working directory, whatever git says", async () => {
    const result = await states({ upstreams: [GONE, { branch: "main", upstream: "origin/main", gone: true }] });

    expect(keptReason(result, "repo")).toBe("main-working-directory");
    expect(result.finished.map((one) => one.label)).not.toContain("repo");
  });

  it("keeps a directory a run is working in", async () => {
    const result = await states({ directories: [directory({ runs: [run()] })], upstreams: [GONE] });

    expect(keptReason(result)).toBe("a-run-is-recorded");
  });

  it("keeps a directory that is not on a branch", async () => {
    const detached = directory();
    delete (detached as { branch?: string }).branch;
    const result = await states({ directories: [detached], upstreams: [GONE] });

    expect(keptReason(result)).toBe("no-branch");
  });

  it("keeps everything where the fetch failed", async () => {
    const result = await states({});

    expect(keptReason(result)).toBe("the-fetch-failed");
    expect(result.finished).toEqual([]);
  });

  it("keeps a branch that was never pushed, however its change stands", async () => {
    const result = await states({
      upstreams: [NEVER_PUSHED],
      standings: standingsWith({ pullRequest: { number: 1, state: "MERGED" } }),
    });

    expect(keptReason(result)).toBe("branch-never-pushed");
  });

  it("keeps a branch the server still has", async () => {
    const result = await states({ upstreams: [PUSHED] });

    expect(keptReason(result)).toBe("branch-still-on-the-server");
  });

  it("keeps a directory holding uncommitted work", async () => {
    const result = await states({ upstreams: [GONE], clean: false });

    expect(keptReason(result)).toBe("uncommitted-work");
  });

  it("finishes with a directory whose branch is gone, needing no change and no standings", async () => {
    const result = await states({ upstreams: [GONE] });

    expect(finishedReason(result)).toBe("branch-gone");
    expect(describeFinished("branch-gone")).toContain("gone from the server");
  });

  it("finishes with one whose pull request merged, where the branch is still there", async () => {
    const result = await states({
      directories: [directory({ belongsTo: "demo", changes: [change("demo")] })],
      upstreams: [PUSHED],
      standings: standingsWith({ pullRequest: { number: 7, state: "MERGED" } }),
    });

    expect(finishedReason(result)).toBe("pull-request-merged");
  });

  it("finishes with one whose change is archived on the default branch", async () => {
    const result = await states({
      directories: [directory({ belongsTo: "demo", changes: [change("demo")] })],
      upstreams: [PUSHED],
      standings: standingsWith({ main: { kind: "archived", archiveName: "2026-09-20-demo" } }),
    });

    expect(finishedReason(result)).toBe("archived-on-main");
  });

  it("names the change where one settled it, and none where git did", async () => {
    const byGit = await states({ upstreams: [GONE] });
    expect(byGit.finished[0]?.changeName).toBeUndefined();

    const byChange = await states({
      directories: [directory({ belongsTo: "demo", changes: [change("demo")] })],
      upstreams: [GONE],
    });
    expect(byChange.finished[0]?.changeName).toBe("demo");
  });

  it("says why it kept each one, in words", () => {
    expect(describeKept("the-fetch-failed")).toContain("stale");
    expect(describeKept("branch-never-pushed")).toContain("never pushed");
  });
});

describe("the sweep", () => {
  function deps(overrides: Partial<Parameters<typeof sweepFinishedDirectories>[1]> = {}) {
    return {
      git: {
        fetch: vi.fn(async () => undefined),
        branchUpstreams: vi.fn(async () => [GONE]),
        worktreeRemove: vi.fn(async () => undefined),
      },
      removeShell: vi.fn(async () => undefined),
      isClean: vi.fn(async () => true),
      ...overrides,
    } as Parameters<typeof sweepFinishedDirectories>[1];
  }

  it("fetches with pruning before it reads: gone appears only then", async () => {
    const given = deps();

    await sweepFinishedDirectories(survey([directory()]), given);

    expect(given.git.fetch).toHaveBeenCalledWith("origin", { prune: true });
  });

  it("removes the worktree with force, and the shell after it", async () => {
    const given = deps();

    const swept = await sweepFinishedDirectories(survey([directory()]), given);

    expect(given.git.worktreeRemove).toHaveBeenCalledWith("/wt/demo", { force: true });
    expect(given.removeShell).toHaveBeenCalledWith("/wt/demo");
    expect(swept.removed.map((one) => one.label)).toEqual(["demo"]);
    expect(swept.removed[0]?.failed).toBeUndefined();
  });

  it("removes nothing where the fetch failed, and says so", async () => {
    const given = deps({
      git: {
        fetch: vi.fn(async () => { throw new Error("no network"); }),
        branchUpstreams: vi.fn(async () => [GONE]),
        worktreeRemove: vi.fn(async () => undefined),
      },
    });

    const swept = await sweepFinishedDirectories(survey([directory()]), given);

    expect(swept.fetchFailed).toContain("no network");
    expect(swept.removed).toEqual([]);
    expect(given.git.worktreeRemove).not.toHaveBeenCalled();
  });

  // the-sweep-finishes-what-it-starts: git on Windows gave up on a long
  // path after forgetting the worktree, and the half it left was never
  // looked at again.
  it("finishes a removal git gave up on, and has git forget the worktree", async () => {
    const worktreePrune = vi.fn(async () => undefined);
    const given = deps({
      git: {
        fetch: vi.fn(async () => undefined),
        branchUpstreams: vi.fn(async () => [GONE]),
        worktreeRemove: vi.fn(async () => { throw new Error("failed to delete: Filename too long"); }),
        worktreePrune,
      },
    });

    const swept = await sweepFinishedDirectories(survey([directory()]), given);

    expect(given.removeShell).toHaveBeenCalledWith("/wt/demo");
    expect(worktreePrune).toHaveBeenCalled();
    expect(swept.removed[0]?.failed).toBeUndefined();
  });

  it("reports a removal that failed both ways rather than throwing, with git's reason", async () => {
    const given = deps({
      git: {
        fetch: vi.fn(async () => undefined),
        branchUpstreams: vi.fn(async () => [GONE]),
        worktreeRemove: vi.fn(async () => { throw new Error("in use"); }),
      },
      removeShell: vi.fn(async () => { throw new Error("EBUSY"); }),
    });

    const swept = await sweepFinishedDirectories(survey([directory()]), given);

    expect(swept.removed[0]?.failed).toContain("in use");
  });
});

function change(changeName: string) {
  return { changeName, tasksDone: 1, tasksTotal: 1, blockers: [], alsoIn: [] };
}

function standingsWith(partial: Record<string, unknown>): ChangeStandings {
  return {
    readAt: "2026-09-20T12:00:00.000Z",
    sources: { fetch: { attempted: false }, pullRequests: { read: true } },
    standings: [{ changeName: "demo", elsewhere: [], ...partial }],
  } as ChangeStandings;
}
