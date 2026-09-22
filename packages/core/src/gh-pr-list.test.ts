import { describe, expect, it } from "vitest";
import { buildGhPrListInvocation, listPullRequestsByBranch } from "./gh-pr-gateway.js";

describe("listPullRequestsByBranch (a-change-says-where-it-stands 2.2)", () => {
  it("reads every pull request in one gh call and maps it by branch", async () => {
    const calls: string[][] = [];
    const recorded = JSON.stringify([
      { number: 12, state: "CLOSED", headRefName: "alpha" },
      { number: 9, state: "MERGED", headRefName: "alpha" },
      { number: 7, state: "OPEN", headRefName: "beta" },
      { number: 3, state: "CLOSED", headRefName: "gamma" },
    ]);

    const read = await listPullRequestsByBranch({
      cwd: "/repo",
      exec: async (_binary, args) => {
        calls.push(args);
        return { stdout: recorded, stderr: "" };
      },
    });

    expect(calls).toEqual([buildGhPrListInvocation().args]);
    expect(read.available).toBe(true);
    if (read.available) {
      // A merged or open request is kept over a closed one.
      expect(read.byBranch.get("alpha")).toEqual({ number: 9, state: "MERGED" });
      expect(read.byBranch.get("beta")).toEqual({ number: 7, state: "OPEN" });
      expect(read.byBranch.get("gamma")).toEqual({ number: 3, state: "CLOSED" });
    }
  });

  // a-change-knows-its-stage: the times a change entered review and landed.
  it("keeps when each pull request was opened and merged, where gh says", async () => {
    const recorded = JSON.stringify([
      { number: 9, state: "MERGED", headRefName: "alpha", createdAt: "2026-09-21T09:00:00Z", mergedAt: "2026-09-22T09:00:00Z" },
      { number: 7, state: "OPEN", headRefName: "beta", createdAt: "2026-09-22T08:00:00Z", mergedAt: null },
    ]);

    const read = await listPullRequestsByBranch({ cwd: "/repo", exec: async () => ({ stdout: recorded, stderr: "" }) });

    expect(buildGhPrListInvocation().args).toContain("number,state,headRefName,createdAt,mergedAt");
    expect(read.available && read.byBranch.get("alpha")).toEqual({ number: 9, state: "MERGED", createdAt: "2026-09-21T09:00:00Z", mergedAt: "2026-09-22T09:00:00Z" });
    expect(read.available && read.byBranch.get("beta")).toEqual({ number: 7, state: "OPEN", createdAt: "2026-09-22T08:00:00Z" });
  });

  it("says gh is not installed, and guesses nothing", async () => {
    const read = await listPullRequestsByBranch({
      cwd: "/repo",
      exec: async () => {
        throw Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" });
      },
    });

    expect(read).toEqual({ available: false, reason: "gh is not installed" });
  });

  it("says gh is not signed in", async () => {
    const read = await listPullRequestsByBranch({
      cwd: "/repo",
      exec: async () => {
        throw new Error("gh pr list exited with code 4: To get started with GitHub CLI, please run:  gh auth login");
      },
    });

    expect(read).toEqual({ available: false, reason: "gh is not signed in" });
  });

  // a-gh-refusal-names-its-cause 1.2: gh's refusal as
  // a-change-says-where-it-stands 10.6 recorded it, which also names
  // `gh auth login`.
  it("says no remote is on a GitHub host gh knows, not that gh is signed out", async () => {
    const read = await listPullRequestsByBranch({
      cwd: "/repo",
      exec: async () => {
        throw new Error("gh pr list exited with code 1: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`");
      },
    });

    expect(read).toEqual({ available: false, reason: "no remote is on a GitHub host gh knows" });
  });

  it("says so when gh prints something that is not a list of pull requests", async () => {
    const read = await listPullRequestsByBranch({ cwd: "/repo", exec: async () => ({ stdout: "oops", stderr: "" }) });

    expect(read).toEqual({ available: false, reason: "gh printed something that is not JSON" });
  });
});
