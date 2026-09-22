import { describe, expect, it } from "vitest";
import { detectForge, forgeFor } from "./forge.js";
import { parseForgeRemote } from "./forge-remote.js";
import { createGitLabForge, createGiteaForge, giteaHeadBranch, type FetchLike } from "./http-forges.js";

// the-forge-is-gitlab-or-gitea-too. No network: each forge is handed a
// fetch that answers from a table and records what it was asked. The
// shapes are the ones Gitea 1.26.4 answered live on 2026-09-22.

interface Asked { method: string; url: string; headers: Record<string, string>; body?: unknown }

function fetchFrom(routes: Array<[string, string, number, unknown]>): { fetch: FetchLike; asked: Asked[] } {
  const asked: Asked[] = [];
  const fetch: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET";
    asked.push({ method, url, headers: init?.headers ?? {}, ...(init?.body !== undefined ? { body: JSON.parse(init.body) } : {}) });
    const route = routes.find(([m, u]) => m === method && url.startsWith(u));
    if (!route) return { ok: false, status: 404, text: async () => JSON.stringify({ message: "not found" }) };
    const [, , status, body] = route;
    return { ok: status < 400, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) };
  };
  return { fetch, asked };
}

const GITEA = "http://gitea.test:3000";
const REPO = `${GITEA}/api/v1/repos/root/demo`;

describe("parseForgeRemote", () => {
  it("reads https, http with a port, scp-like and ssh remotes, and leaves credentials out", () => {
    expect(parseForgeRemote("https://gitlab.com/group/sub/project.git")).toEqual({ host: "gitlab.com", webBase: "https://gitlab.com", path: "group/sub/project" });
    expect(parseForgeRemote("http://root:secret@gitea.test:3000/root/demo.git")).toEqual({ host: "gitea.test", webBase: "http://gitea.test:3000", path: "root/demo" });
    expect(parseForgeRemote("git@gitea.test:root/demo.git")).toEqual({ host: "gitea.test", path: "root/demo" });
    expect(parseForgeRemote("ssh://git@gitea.test:2222/root/demo.git")).toEqual({ host: "gitea.test", path: "root/demo" });
    expect(parseForgeRemote("not a url")).toBeUndefined();
  });
});

describe("detectForge", () => {
  it("knows github.com and gitlab.com without asking", async () => {
    const { fetch, asked } = fetchFrom([]);
    expect(await detectForge("https://github.com/o/r.git", { fetch, env: {} })).toEqual({ kind: "github" });
    expect(await detectForge("git@gitlab.com:o/r.git", { fetch, env: {} })).toMatchObject({ kind: "gitlab", base: "https://gitlab.com", path: "o/r" });
    expect(asked).toEqual([]);
  });

  it("asks another host what it is: Gitea by its version, GitLab by its version or a refusal", async () => {
    const gitea = fetchFrom([["GET", `${GITEA}/api/v1/version`, 200, { version: "1.26.4" }]]);
    expect(await detectForge(`${GITEA}/root/demo.git`, { fetch: gitea.fetch, env: {} })).toEqual({ kind: "gitea", base: GITEA, path: "root/demo" });

    const gitlab = fetchFrom([["GET", "https://git.corp/api/v4/version", 401, { message: "401 Unauthorized" }]]);
    expect(await detectForge("https://git.corp/team/app.git", { fetch: gitlab.fetch, env: {} })).toMatchObject({ kind: "gitlab", base: "https://git.corp" });
  });

  it("takes an ssh remote's web root from GITEA_URL, and falls back on GitHub where nothing answers", async () => {
    const { fetch } = fetchFrom([]);
    expect(await detectForge("git@gitea.test:root/demo.git", { fetch, env: { GITEA_URL: GITEA } })).toEqual({ kind: "gitea", base: GITEA, path: "root/demo" });
    expect(await detectForge("https://nobody.test/o/r.git", { fetch, env: {} })).toEqual({ kind: "github" });
  });

  it("makes the forge the remote is on, with the token from the environment", async () => {
    const { fetch } = fetchFrom([["GET", `${GITEA}/api/v1/version`, 200, { version: "1.26.4" }]]);

    const forge = await forgeFor("/repo", { fetch, env: {}, remoteUrl: async () => `${GITEA}/root/demo.git` });

    expect(forge.name).toBe("Gitea");
    expect(await forge.pullRequestsByBranch()).toEqual({ available: false, reason: "GITEA_TOKEN is not set" });
  });
});

describe("the Gitea forge", () => {
  const forgeWith = (routes: Array<[string, string, number, unknown]>) => {
    const made = fetchFrom(routes);
    return { ...made, forge: createGiteaForge({ base: GITEA, path: "root/demo", token: "t0ken", tokenName: "GITEA_TOKEN", fetch: made.fetch }) };
  };

  it("lists pull requests by branch, a merged one by the name its label keeps", async () => {
    const { forge, asked } = forgeWith([["GET", `${REPO}/pulls?`, 200, [
      { number: 3, state: "open", merged: false, head: { ref: "feature", label: "feature" } },
      { number: 2, state: "closed", merged: true, head: { ref: "refs/pull/2/head", label: "done" } },
      { number: 1, state: "closed", merged: false, head: { ref: "refs/pull/1/head", label: "someone:dropped" } },
    ]]]);

    const read = await forge.pullRequestsByBranch();

    expect(read.available && [...read.byBranch]).toEqual([
      ["feature", { number: 3, state: "OPEN" }],
      ["done", { number: 2, state: "MERGED" }],
      ["dropped", { number: 1, state: "CLOSED" }],
    ]);
    expect(asked[0]?.headers.Authorization).toBe("token t0ken");
  });

  it("reads a 404 on the list as no pull requests where the repository is there", async () => {
    const { forge } = forgeWith([["GET", `${REPO}/pulls?`, 404, { message: "not found" }], ["GET", REPO, 200, { name: "demo" }]]);

    const read = await forge.pullRequestsByBranch();

    expect(read.available && read.byBranch.size).toBe(0);
  });

  it("says so where the repository itself is not there", async () => {
    const { forge } = forgeWith([]);

    const read = await forge.pullRequestsByBranch();

    expect(read.available).toBe(false);
  });

  it("opens a pull request, and asks for a squash merge once checks pass", async () => {
    const { forge, asked } = forgeWith([
      ["POST", `${REPO}/pulls/7/merge`, 200, undefined],
      ["POST", `${REPO}/pulls`, 201, { number: 7, html_url: `${GITEA}/root/demo/pulls/7` }],
    ]);

    expect(await forge.openPullRequest({ head: "a", base: "main", title: "Archive a", body: "b" })).toEqual({ number: 7, url: `${GITEA}/root/demo/pulls/7` });
    expect(await forge.mergeWhenChecksPass(7)).toEqual({ ok: true, method: "squash" });
    expect(asked.at(-1)?.body).toEqual({ Do: "squash", merge_when_checks_succeed: true, delete_branch_after_merge: true });
  });

  it("says what a refused token is", async () => {
    const { forge } = forgeWith([["GET", `${REPO}/pulls?`, 401, { message: "token is required" }]]);

    expect(await forge.pullRequestsByBranch()).toEqual({ available: false, reason: "the GITEA_TOKEN was refused (401)" });
  });

  it("reads a branch from a head, whatever Gitea left in it", () => {
    expect(giteaHeadBranch({ ref: "x", label: "x" })).toBe("x");
    expect(giteaHeadBranch({ ref: "refs/pull/9/head", label: "owner:y" })).toBe("y");
    expect(giteaHeadBranch(undefined)).toBeUndefined();
  });
});

describe("the GitLab forge", () => {
  const PROJECT = "https://gitlab.com/api/v4/projects/group%2Fapp";
  const forgeWith = (routes: Array<[string, string, number, unknown]>) => {
    const made = fetchFrom(routes);
    return { ...made, forge: createGitLabForge({ base: "https://gitlab.com", path: "group/app", token: "glpat", tokenName: "GITLAB_TOKEN", fetch: made.fetch }) };
  };

  it("lists merge requests by source branch, with the token in its header", async () => {
    const { forge, asked } = forgeWith([["GET", `${PROJECT}/merge_requests?`, 200, [
      { iid: 5, state: "opened", source_branch: "feature" },
      { iid: 4, state: "merged", source_branch: "done" },
      { iid: 3, state: "closed", source_branch: "dropped" },
    ]]]);

    const read = await forge.pullRequestsByBranch();

    expect(read.available && [...read.byBranch]).toEqual([
      ["feature", { number: 5, state: "OPEN" }],
      ["done", { number: 4, state: "MERGED" }],
      ["dropped", { number: 3, state: "CLOSED" }],
    ]);
    expect(asked[0]?.headers["PRIVATE-TOKEN"]).toBe("glpat");
  });

  it("opens a merge request that removes its branch, and asks for an automatic merge", async () => {
    const { forge, asked } = forgeWith([
      ["GET", `${PROJECT}/merge_requests/8`, 200, { detailed_merge_status: "mergeable" }],
      ["PUT", `${PROJECT}/merge_requests/8/merge`, 200, { state: "merged" }],
      ["POST", `${PROJECT}/merge_requests`, 201, { iid: 8, web_url: "https://gitlab.com/group/app/-/merge_requests/8" }],
    ]);

    expect(await forge.openPullRequest({ head: "a", base: "main", title: "Archive a", body: "b" })).toEqual({ number: 8, url: "https://gitlab.com/group/app/-/merge_requests/8" });
    expect(asked.at(-1)?.body).toMatchObject({ source_branch: "a", target_branch: "main", remove_source_branch: true });
    expect(await forge.mergeWhenChecksPass(8)).toEqual({ ok: true, method: "squash" });
    expect(asked.at(-1)?.body).toMatchObject({ auto_merge: true, should_remove_source_branch: true });
  });

  // Seen live on gitlab.com, 2026-09-22: a merge asked for a moment after
  // opening was refused with 422 while GitLab was still checking.
  it("waits for GitLab to decide, and tries a refused merge again before believing it", async () => {
    let readings = 0;
    let merges = 0;
    const slept: number[] = [];
    const fetch: FetchLike = async (url, init) => {
      if ((init?.method ?? "GET") === "GET") {
        readings += 1;
        return { ok: true, status: 200, text: async () => JSON.stringify({ detailed_merge_status: readings < 3 ? "checking" : "mergeable" }) };
      }
      merges += 1;
      return merges < 2
        ? { ok: false, status: 422, text: async () => JSON.stringify({ message: "Branch cannot be merged" }) }
        : { ok: true, status: 200, text: async () => "{}" };
    };
    const forge = createGitLabForge({ base: "https://gitlab.com", path: "group/app", token: "glpat", tokenName: "GITLAB_TOKEN", fetch, sleep: async (ms) => { slept.push(ms); } });

    expect(await forge.mergeWhenChecksPass(8)).toEqual({ ok: true, method: "squash" });
    expect(readings).toBe(3);
    expect(merges).toBe(2);
    expect(slept.length).toBe(3);
  });

  it("says why where GitLab will not merge", async () => {
    const made = fetchFrom([["PUT", `${PROJECT}/merge_requests/8/merge`, 405, { message: "405 Method Not Allowed" }]]);
    const forge = createGitLabForge({ base: "https://gitlab.com", path: "group/app", token: "glpat", tokenName: "GITLAB_TOKEN", fetch: made.fetch, sleep: async () => undefined });

    const answer = await forge.mergeWhenChecksPass(8);

    expect(answer.ok).toBe(false);
    expect(answer.ok === false && answer.reason).toContain("405");
  });
});
