import { describe, expect, it, vi } from "vitest";
import type { GitStatusSummary, GitWrapper } from "./git.js";
import { commitOpenSpecSetup, describeSetupCommitted, uncommittedPaths } from "./openspec-setup-commit.js";

// every-varying-check-has-a-budget: the git wrapper is a fake; nothing is
// spawned.
vi.setConfig({ testTimeout: 15_000 });

function status(notAdded: string[], modified: string[] = []): GitStatusSummary {
  return { current: "main", ahead: 0, behind: 0, staged: [], modified, notAdded, deleted: [], isClean: false };
}

function fakeGit(options: { branch?: string; remote?: string | undefined; now: GitStatusSummary; pushFails?: string }) {
  const staged: string[] = [];
  const pushed: Array<[string, string]> = [];
  const messages: string[] = [];
  const git = {
    remoteUrl: async () => ("remote" in options ? options.remote : "https://example.test/shop.git"),
    currentBranch: async () => options.branch ?? "main",
    status: async () => options.now,
    stagePath: async (entry: string) => { staged.push(entry); },
    commit: async (message: string) => { messages.push(message); return { commit: "abc1234" }; },
    push: async (remote: string, branch: string) => {
      if (options.pushFails) throw new Error(options.pushFails);
      pushed.push([remote, branch]);
    },
  } as unknown as GitWrapper;
  return { git, staged, pushed, messages };
}

// agents-are-told-how-work-is-done-here 1.5: a repository just initialized
// had nothing on the server to cut a change from, and the agent stopped.
describe("commitOpenSpecSetup", () => {
  it("commits what initializing made, and only that, to main, and pushes it", async () => {
    const before = await uncommittedPaths({ status: async () => status(["notes.txt"]) });
    const { git, staged, pushed, messages } = fakeGit({
      now: status(["notes.txt", "openspec/", ".claude/", "CLAUDE.md", ".openspec-ui/"], ["AGENTS.md"]),
    });

    const result = await commitOpenSpecSetup({ repositoryRoot: "/repo", before, git });

    expect(result).toEqual({ state: "pushed", paths: [".claude/", "AGENTS.md", "CLAUDE.md", "openspec/"], commit: "abc1234" });
    expect(staged).toEqual([".claude/", "AGENTS.md", "CLAUDE.md", "openspec/"]);
    expect(pushed).toEqual([["origin", "main"]]);
    expect(messages[0]).toContain("chore: set up OpenSpec");
    expect(describeSetupCommitted(result)).toContain("each change can now be cut from origin/main");
  });

  it("commits nothing on another branch, or where there is no remote", async () => {
    const elsewhere = fakeGit({ branch: "feature", now: status(["openspec/"]) });
    expect(await commitOpenSpecSetup({ repositoryRoot: "/repo", before: new Set(), git: elsewhere.git })).toEqual({ state: "not-on-default-branch", branch: "feature" });
    expect(elsewhere.staged).toEqual([]);

    const local = fakeGit({ remote: undefined, now: status(["openspec/"]) });
    expect(await commitOpenSpecSetup({ repositoryRoot: "/repo", before: new Set(), git: local.git })).toEqual({ state: "no-remote" });
  });

  it("keeps the commit and says why where the push is refused", async () => {
    const { git } = fakeGit({ now: status(["openspec/"]), pushFails: "! [remote rejected] main -> main (protected branch)" });

    const result = await commitOpenSpecSetup({ repositoryRoot: "/repo", before: new Set(), git });

    expect(result).toMatchObject({ state: "committed", reason: "! [remote rejected] main -> main (protected branch)" });
    expect(describeSetupCommitted(result)).toContain("push it before making a change");
  });
});
