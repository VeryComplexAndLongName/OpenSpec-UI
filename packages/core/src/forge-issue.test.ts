import { describe, expect, it, vi } from "vitest";
import { readForgeIssue } from "./forge-issue.js";
import { createGitHubForge } from "./gh-pr-gateway.js";
import { createGiteaForge, createGitHubApiForge, createGitLabForge } from "./http-forges.js";

describe("repository issue readers", () => {
  it.each(["github", "gitea", "gitlab"] as const)("normalizes %s identities and empty bodies", (kind) => {
    expect(readForgeIssue({ number: 12, iid: 12, title: "A request", body: null, description: null }, 12, kind))
      .toEqual({ number: 12, title: "A request", body: "", state: "unknown", updatedAt: "unknown" });
  });
  it("refuses PRs, wrong identities, malformed and oversized sources", () => {
    for (const value of [null, { number: 1, title: "PR", pull_request: {} }, { number: 2, title: "Wrong" },
      { number: 1, title: "Invalid", body: 12 }, { number: 1, title: "Large", body: "x".repeat(256 * 1024) }]) {
      expect(() => readForgeIssue(value, 1, "github")).toThrow();
    }
  });
  it.each([
    [createGitHubApiForge, "https://forge.test/api/repos/team/project/issues/12"],
    [createGiteaForge, "https://forge.test/api/v1/repos/team/project/issues/12"],
    [createGitLabForge, "https://forge.test/api/v4/projects/team%2Fproject/issues/12"],
  ] as const)("uses only the configured numeric API route", async (factory, expected) => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ number: 12, iid: 12, title: "Request", body: "https://evil.test", description: "Data" }) }));
    const forge = factory({ base: "https://forge.test", apiBase: "https://forge.test/api", path: "team/project", token: "not-a-real-token", tokenName: "TOKEN", fetch });
    expect((await forge.readIssue!(12)).title).toBe("Request");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(expected, expect.objectContaining({ method: "GET", redirect: "error", signal: expect.any(AbortSignal) }));
    await expect(forge.readIssue!(-1)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("reads GitHub through gh without executing issue content", async () => {
    const exec = vi.fn(async () => ({ stdout: JSON.stringify({ number: 12, title: "$(do-not-run)", body: "Untrusted" }), stderr: "" }));
    const forge = createGitHubForge({ cwd: "/repo", githubRepository: "team/project", exec });
    expect((await forge.readIssue!(12)).title).toBe("$(do-not-run)");
    expect(exec).toHaveBeenCalledWith("gh", ["api", "--hostname", "github.com", "repos/team/project/issues/12"], expect.objectContaining({ cwd: "/repo" }));
  });
  it("reports authorization failures without treating them as empty issues", async () => {
    const forge = createGitLabForge({ base: "https://forge.test", path: "team/repo", token: undefined, tokenName: "GITLAB_TOKEN",
      fetch: async () => ({ ok: false, status: 401, text: async () => "Denied" }) });
    await expect(forge.readIssue!(1)).rejects.toThrow(/GITLAB_TOKEN/);
  });
});
