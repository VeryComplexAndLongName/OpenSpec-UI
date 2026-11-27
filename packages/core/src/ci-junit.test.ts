import { describe, expect, it, vi } from "vitest";
import { readGiteaJUnit, readGitLabJUnit } from "./ci-junit.js";

const sha = "a".repeat(40);
const xml = '<testsuite><testcase classname="Session" name="expires"/></testsuite>';
// Deflated archive with the two files from the documented producer convention.
const zip = Buffer.from("UEsDBBQAAAAIAGaiel0XsgbCOAAAAEUAAAAJAAAAanVuaXQueG1ssylJLS4pLs0sSbWzATGTE4tTFZJzEouL8xJzU22VglOLizPz85QUINzUioLMotRiJX07G32ETgBQSwMEFAAAAAgAZqJ6XV6JGnkHAAAAKQAAABEAAAB0ZXN0ZWQtY29tbWl0LnR4dEtMJA5wAQBQSwECFAAUAAAACABmonpdF7IGwjgAAABFAAAACQAAAAAAAAAAAAAAgAEAAAAAanVuaXQueG1sUEsBAhQAFAAAAAgAZqJ6XV6JGnkHAAAAKQAAABEAAAAAAAAAAAAAAIABXwAAAHRlc3RlZC1jb21taXQudHh0UEsFBgAAAAACAAIAdgAAAJUAAAAAAA==", "base64");
const giteaApi = "https://gitea.example/api/v1/repos/team/app";
const gitlabApi = "https://gitlab.com/api/v4/projects/team%2Fapp";
const artifact = { id: 23, name: "openspec-junit", expired: false, size_in_bytes: zip.length,
  workflow_run: { id: 12, head_sha: sha, repository_id: 8 } };

function giteaApiFixture(listing: unknown) {
  const archiveUrl = `${giteaApi}/actions/artifacts/23/zip`;
  const rawUrl = archiveUrl + "/raw?signature=fixture";
  const gateway = new Map<string, Response>([
    [giteaApi, Response.json({ id: 8 })],
    [`${giteaApi}/actions/runs/12`, Response.json({ id: 12, head_sha: sha, repository_id: 0 })],
    [`${giteaApi}/actions/runs/12/artifacts`, Response.json(listing)],
    [archiveUrl, Response.redirect(rawUrl)],
    [rawUrl, new Response(new Uint8Array(zip))],
  ]);
  const fetch = vi.fn<typeof globalThis.fetch>(async (url) => gateway.get(String(url)) ?? new Response(null, { status: 404 }));
  return { api: giteaApi, repository: "team/app", headers: { Authorization: "token fixture" }, fetch };
}

function gitlabApiFixture(revision: string, download: Response = new Response(xml)) {
  const gateway = new Map<string, Response>([
    [`${gitlabApi}/jobs/7`, Response.json({ id: 7, commit: { id: sha }, pipeline: { id: 33, sha } })],
    [`${gitlabApi}/jobs/7/artifacts/tested-commit.txt`, new Response(revision)],
    [`${gitlabApi}/jobs/7/artifacts/junit.xml`, download],
    ["https://storage.googleapis.com/fixture/report", new Response(xml)],
  ]);
  const fetch = vi.fn<typeof globalThis.fetch>(async (url) => gateway.get(String(url)) ?? new Response(null, { status: 404 }));
  return { api: gitlabApi, repository: "team/app", headers: { "PRIVATE-TOKEN": "fixture" }, fetch };
}

describe("CI JUnit artifact import", () => {
  it("binds the Gitea ZIP to the verified run and repository", async () => {
    const origin = giteaApiFixture({ total_count: 1, artifacts: [artifact] });
    await expect(readGiteaJUnit(origin, 12)).resolves.toEqual({
      testedCommit: sha, xml, source: { forge: "Gitea", repository: "team/app", execution: 12, artifact: 23 },
    });
    expect(origin.fetch).toHaveBeenLastCalledWith(new URL(`${giteaApi}/actions/artifacts/23/zip/raw?signature=fixture`), {
      signal: expect.any(AbortSignal), redirect: "error", credentials: "omit",
    });
  });

  it.each([
    { total_count: 1, artifacts: [{ ...artifact, expired: true }] },
    { total_count: 1, artifacts: [{ ...artifact, workflow_run: { ...artifact.workflow_run, repository_id: 9 } }] },
    { total_count: 2, artifacts: [artifact, { ...artifact, id: 24 }] },
  ])("refuses a Gitea artifact with invalid or ambiguous metadata", async (listing) => {
    const origin = giteaApiFixture(listing);
    await expect(readGiteaJUnit(origin, 12)).rejects.toThrow();
    expect(origin.fetch.mock.calls.every(([url]) => !String(url).endsWith("/zip"))).toBe(true);
  });

  it("reads exact GitLab job files and does not send the token to storage", async () => {
    const origin = gitlabApiFixture(sha, Response.redirect("https://storage.googleapis.com/fixture/report"));
    await expect(readGitLabJUnit(origin, 7)).resolves.toEqual({
      testedCommit: sha, xml, source: { forge: "GitLab", repository: "team/app", execution: 7, pipeline: 33 },
    });
    expect(origin.fetch).toHaveBeenLastCalledWith(new URL("https://storage.googleapis.com/fixture/report"), {
      signal: expect.any(AbortSignal), redirect: "error", credentials: "omit",
    });
  });

  it("refuses a different checkout, unexpected redirect or oversized report", async () => {
    await expect(readGitLabJUnit(gitlabApiFixture("b".repeat(40)), 7)).rejects.toThrow("checkout revision");
    const offsite = gitlabApiFixture(sha, Response.redirect("https://unrelated.example/report"));
    await expect(readGitLabJUnit(offsite, 7)).rejects.toThrow("redirected");
    expect(offsite.fetch).toHaveBeenCalledTimes(3);
    await expect(readGitLabJUnit(gitlabApiFixture(sha, new Response("x".repeat(128 * 1024 + 1))), 7)).rejects.toThrow("import limit");
  });
});
