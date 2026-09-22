import { describe, expect, it } from "vitest";
import { forgeFor, pullRequestGatewayFor } from "./forge.js";
import { PENDING_REASON, pullRequestGatewayOver, type Forge } from "./gh-pr-gateway.js";
import { createGitHubApiForge, createGitLabForge, createGiteaForge, type FetchLike } from "./http-forges.js";

// github-without-gh. No network: a fetch that answers from a table. The
// shapes are the ones GitHub, GitLab and Gitea answered live on 2026-09-22.

interface Asked { method: string; url: string; body?: unknown }

function fetchFrom(routes: Array<[string, string, number, unknown]>): { fetch: FetchLike; asked: Asked[] } {
  const asked: Asked[] = [];
  const fetch: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET";
    asked.push({ method, url, ...(init?.body !== undefined ? { body: JSON.parse(init.body) } : {}) });
    const route = routes.find(([m, u]) => m === method && url.startsWith(u));
    if (!route) return { ok: false, status: 404, text: async () => JSON.stringify({ message: "Not Found" }) };
    const [, , status, body] = route;
    return { ok: status < 400, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) };
  };
  return { fetch, asked };
}

const API = "https://api.github.com";
const REPO = `${API}/repos/owner/app`;

function github(routes: Array<[string, string, number, unknown]>) {
  const made = fetchFrom(routes);
  return { ...made, forge: createGitHubApiForge({ base: "https://github.com", path: "owner/app", token: "ghs", tokenName: "GITHUB_TOKEN", fetch: made.fetch }) };
}

describe("GitHub through its API", () => {
  it("lists pull requests by branch, merged by their merge date", async () => {
    const { forge } = github([["GET", `${REPO}/pulls?`, 200, [
      { number: 3, state: "open", merged_at: null, head: { ref: "feature" } },
      { number: 2, state: "closed", merged_at: "2026-09-22T00:00:00Z", head: { ref: "done" } },
      { number: 1, state: "closed", merged_at: null, head: { ref: "dropped" } },
    ]]]);

    const read = await forge.pullRequestsByBranch();

    expect(read.available && [...read.byBranch]).toEqual([
      ["feature", { number: 3, state: "OPEN" }],
      ["done", { number: 2, state: "MERGED" }],
      ["dropped", { number: 1, state: "CLOSED" }],
    ]);
  });

  it("merges by the method it is given, and never asks GitHub for an automatic merge", async () => {
    const { forge, asked } = github([
      ["GET", `${REPO}/pulls/5`, 200, { head: { ref: "archive-landed-x" } }],
      ["PUT", `${REPO}/pulls/5/merge`, 200, { merged: true }],
      ["DELETE", `${REPO}/git/refs/heads/archive-landed-x`, 204, undefined],
    ]);

    await forge.mergeNow(5, "squash");

    expect(asked.find((one) => one.method === "PUT")?.body).toEqual({ merge_method: "squash" });
    expect(asked.some((one) => one.url.endsWith("/graphql"))).toBe(false);
  });

  it("says GitHub's own reason where it refuses a merge", async () => {
    const { forge } = github([
      ["GET", `${REPO}/pulls/5`, 200, { head: { ref: "x" } }],
      ["PUT", `${REPO}/pulls/5/merge`, 405, { message: "Squash merges are not allowed on this repository." }],
    ]);

    await expect(forge.mergeNow(5, "squash")).rejects.toThrow("Squash merges are not allowed on this repository.");
  });

  it("reads checks from check runs and commit statuses together", async () => {
    const { forge } = github([
      ["GET", `${REPO}/pulls/5`, 200, { head: { sha: "abc" } }],
      ["GET", `${REPO}/commits/abc/check-runs`, 200, { check_runs: [{ name: "build", status: "completed", conclusion: "success" }] }],
      ["GET", `${REPO}/commits/abc/status`, 200, { statuses: [{ context: "deploy", state: "failure" }] }],
    ]);

    expect(await forge.checksOf(5)).toEqual({ state: "fail", reason: "check failed: deploy (failure)" });
  });

  it("merges now and deletes the branch, as gh pr merge --delete-branch does", async () => {
    const { forge, asked } = github([
      ["GET", `${REPO}/pulls/5`, 200, { head: { ref: "feature/x" } }],
      ["PUT", `${REPO}/pulls/5/merge`, 200, { merged: true }],
      ["DELETE", `${REPO}/git/refs/heads/feature/x`, 204, undefined],
    ]);

    await forge.mergeNow(5);

    expect(asked.map((one) => one.method)).toEqual(["GET", "PUT", "DELETE"]);
  });
});

describe("which way to GitHub", () => {
  const remoteUrl = async () => "https://github.com/owner/app.git";

  it("goes through the API where a token is in the environment", async () => {
    const forge = await forgeFor("/repo", { remoteUrl, env: { GH_TOKEN: "ghs" }, fetch: fetchFrom([]).fetch });

    expect(forge.name).toBe("GitHub");
    expect(typeof forge.checksOf).toBe("function");
  });

  it("goes through gh where none is, and says so where gh is missing", async () => {
    const forge = await forgeFor("/repo", { remoteUrl, env: {} });

    expect(forge.name).toBe("GitHub");
    expect(typeof forge.mergeNow).toBe("function");
  });
});

describe("the git stage's gateway over a forge", () => {
  function forgeReading(answers: Array<{ state: "pass" | "fail" | "none"; reason?: string }>): Forge {
    return {
      name: "Test",
      pullRequestsByBranch: async () => ({ available: true, byBranch: new Map() }),
      openPullRequest: async () => ({ number: 9, url: "u" }),
      checksOf: async () => answers.shift() ?? { state: "none", reason: "no more" },
      mergeNow: async () => undefined,
    };
  }

  it("waits while checks are pending, and answers the first decided reading", async () => {
    const gateway = pullRequestGatewayOver(forgeReading([{ state: "none", reason: PENDING_REASON }, { state: "pass" }]), { pollIntervalMs: 0 });

    expect(await gateway.waitForChecks(9)).toEqual({ state: "pass" });
  });

  it("refuses where there are no checks, as ADR 0014 asks", async () => {
    const gateway = pullRequestGatewayOver(forgeReading([{ state: "none", reason: "no check result was available" }]), { pollIntervalMs: 0 });

    expect((await gateway.waitForChecks(9)).state).toBe("none");
  });

  it("is made for GitLab and Gitea, which read checks and merge", async () => {
    const giteaVersion = fetchFrom([["GET", "http://gitea.test:3000/api/v1/version", 200, { version: "1.26.4" }]]);
    const gateway = await pullRequestGatewayFor("/repo", { remoteUrl: async () => "http://gitea.test:3000/root/demo.git", env: { GITEA_TOKEN: "t" }, fetch: giteaVersion.fetch });

    expect(typeof gateway.waitForChecks).toBe("function");
  });
});

describe("checks on GitLab and Gitea", () => {
  it("reads a GitLab merge request's pipeline", async () => {
    const made = fetchFrom([["GET", "https://gitlab.com/api/v4/projects/group%2Fapp/merge_requests/4", 200, { head_pipeline: { id: 77, status: "running" } }]]);
    const forge = createGitLabForge({ base: "https://gitlab.com", path: "group/app", token: "t", tokenName: "GITLAB_TOKEN", fetch: made.fetch });

    expect(await forge.checksOf(4)).toEqual({ state: "none", reason: PENDING_REASON });
  });

  it("reads a Gitea commit's statuses, and none as none", async () => {
    const base = "http://gitea.test:3000/api/v1/repos/root/demo";
    const made = fetchFrom([
      ["GET", `${base}/pulls/2`, 200, { head: { sha: "abc" } }],
      ["GET", `${base}/commits/abc/status`, 200, { statuses: [{ context: "ci", status: "success" }] }],
    ]);
    const forge = createGiteaForge({ base: "http://gitea.test:3000", path: "root/demo", token: "t", tokenName: "GITEA_TOKEN", fetch: made.fetch });

    expect(await forge.checksOf(2)).toEqual({ state: "pass" });
  });
});
