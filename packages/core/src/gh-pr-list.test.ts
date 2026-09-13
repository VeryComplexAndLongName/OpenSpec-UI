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

  it("says so when gh prints something that is not a list of pull requests", async () => {
    const read = await listPullRequestsByBranch({ cwd: "/repo", exec: async () => ({ stdout: "oops", stderr: "" }) });

    expect(read).toEqual({ available: false, reason: "gh printed something that is not JSON" });
  });
});
