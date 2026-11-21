import { expect, it, vi } from "vitest";
import { createGiteaForge, createGitLabForge, type FetchLike } from "./http-forges.js";

const target = { number: 4, baseBranch: "release/next", headCommit: "a".repeat(40) };

it("forwards requested Gitea failure descriptions without claiming complete logs", async () => {
  const base = "http://git.local:3000";
  const fetch = requests(base + "/api/v1/repos/org/app", {
    [`/commits/${target.headCommit}/status?limit=50&page=1`]: { sha: target.headCommit, total_count: 2, statuses: [
      { context: "tests", status: "failure", description: "Assertion failed" }, { context: "build", status: "error" },
    ] },
    "/branches/release%2Fnext": { name: "release/next", protected: false },
  });
  const forge = createGiteaForge({ base, path: "org/app", token: "fixture", tokenName: "GITEA_TOKEN", fetch });
  expect(await forge.reviewChecks?.(target, { failureDetails: true })).toMatchObject({ checks: [
    { failureDetails: { messages: ["Assertion failed"], partial: true } }, { failureDetails: { messages: [], partial: true } },
  ] });
});

it("forwards requested GitLab failure reasons while retaining a generic pipeline's missing detail", async () => {
  const base = "https://gitlab.com";
  const fetch = requests(base + "/api/v4/projects/team%2Fapp", {
    "/merge_requests/4/pipelines?per_page=50&page=1": [{ id: 90, sha: target.headCommit, status: "failed" }],
    "/pipelines/90/jobs?per_page=50&page=1": [{ name: "tests", status: "failed", failure_reason: "script_failure" }],
    "": { only_allow_merge_if_pipeline_succeeds: true },
  });
  const forge = createGitLabForge({ base, path: "team/app", token: "fixture", tokenName: "GITLAB_TOKEN", fetch });
  expect(await forge.reviewChecks?.(target, { failureDetails: true })).toMatchObject({ checks: [
    { name: "Pipeline", failureDetails: { messages: [], partial: true } },
    { name: "tests", failureDetails: { messages: ["script_failure"], partial: true } },
  ] });
});

function requests(base: string, values: Record<string, unknown>) {
  return vi.fn<FetchLike>(async (url, init) => {
    expect(url.startsWith(base)).toBe(true);
    expect(init).toMatchObject({ method: "GET", redirect: "error" });
    const suffix = url.slice(base.length);
    return { ok: suffix in values, status: suffix in values ? 200 : 403, text: async () => JSON.stringify(values[suffix] ?? {}) };
  });
}

it("reads Gitea checks for the published SHA and requirements for the effective branch", async () => {
  const base = "http://git.local:3000";
  const fetch = requests(base + "/api/v1/repos/org/app", {
    [`/commits/${target.headCommit}/status?limit=50&page=1`]: {
      sha: target.headCommit, total_count: 1, statuses: [{ context: "Build", status: "success", target_url: "/org/app/actions/runs/90" }],
    },
    "/branches/release%2Fnext": { name: "release/next", protected: true, enable_status_check: true, status_check_contexts: ["Build", "Test"] },
  });
  const forge = createGiteaForge({ base, path: "org/app", token: "fixture", tokenName: "GITEA_TOKEN", fetch });
  expect(await forge.reviewChecks?.(target)).toEqual({
    kind: "checks", head: target.headCommit, resultsComplete: true, rulesComplete: true,
    checks: [{ name: "Build", state: "success", link: base + "/org/app/actions/runs/90" }],
    expected: [{ name: "Build", state: "Reported" }, { name: "Test", state: "No result on this commit" }],
  });
});

it("reads the matching GitLab pipeline and labels incomplete rules while excluding other commits", async () => {
  const base = "https://gitlab.com";
  const fetch = requests(base + "/api/v4/projects/team%2Fapp", {
    "/merge_requests/4/pipelines?per_page=50&page=1": [
      { id: 100, sha: "b".repeat(40), status: "success" },
      { id: 90, sha: target.headCommit, status: "running", web_url: base + "/team/app/-/pipelines/90" },
    ],
    "/pipelines/90/jobs?per_page=50&page=1": [{ name: "Checkout test", status: "failed", web_url: "https://foreign.invalid/job" }],
    "": { only_allow_merge_if_pipeline_succeeds: true, only_allow_merge_if_all_status_checks_passed: true },
  });
  const forge = createGitLabForge({ base, path: "team/app", token: "fixture", tokenName: "GITLAB_TOKEN", fetch });
  expect(await forge.reviewChecks?.(target)).toEqual({
    kind: "checks", head: target.headCommit, resultsComplete: true, rulesComplete: false,
    checks: [{ name: "Pipeline", state: "running", link: base + "/team/app/-/pipelines/90" }, { name: "Checkout test", state: "failed" }],
    expected: [{ name: "Pipeline", state: "Reported" }],
  });
});
