import { describe, expect, it, vi } from "vitest";

const statusMock = vi.fn();
const diffMock = vi.fn();
const commitMock = vi.fn();
const simpleGitFactory = vi.fn(() => ({
  status: statusMock,
  diff: diffMock,
  commit: commitMock,
}));

vi.mock("simple-git", () => ({ default: simpleGitFactory }));

const { createGitWrapper } = await import("./git.js");

describe("createGitWrapper", () => {
  it("maps simple-git status into GitStatusSummary", async () => {
    statusMock.mockResolvedValue({
      current: "feat-x",
      ahead: 1,
      behind: 0,
      staged: ["a.ts"],
      modified: ["b.ts"],
      not_added: ["c.ts"],
      deleted: [],
      isClean: () => false,
    });

    const wrapper = createGitWrapper({ cwd: "/workspace/repo" });
    const status = await wrapper.status();

    expect(simpleGitFactory).toHaveBeenCalledWith("/workspace/repo");
    expect(status).toEqual({
      current: "feat-x",
      ahead: 1,
      behind: 0,
      staged: ["a.ts"],
      modified: ["b.ts"],
      notAdded: ["c.ts"],
      deleted: [],
      isClean: false,
    });
  });

  it("delegates diff with and without a pathspec", async () => {
    diffMock.mockResolvedValue("diff --git a/x b/x");
    const wrapper = createGitWrapper({ cwd: "/workspace/repo" });

    await wrapper.diff();
    expect(diffMock).toHaveBeenCalledWith();

    await wrapper.diff("src/x.ts");
    expect(diffMock).toHaveBeenCalledWith(["src/x.ts"]);
  });

  it("wraps commit result", async () => {
    commitMock.mockResolvedValue({ commit: "abc123" });
    const wrapper = createGitWrapper({ cwd: "/workspace/repo" });
    const result = await wrapper.commit("fix: something");
    expect(commitMock).toHaveBeenCalledWith("fix: something");
    expect(result).toEqual({ commit: "abc123" });
  });

  it("currentBranch reads status().current", async () => {
    statusMock.mockResolvedValue({ current: "main" });
    const wrapper = createGitWrapper({ cwd: "/workspace/repo" });
    expect(await wrapper.currentBranch()).toBe("main");
  });
});
