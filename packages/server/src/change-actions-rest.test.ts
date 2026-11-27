import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gitIsolationArgs } from "@openspec-ui/core/test-support/git-isolation";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createServer } from "./server.js";
import { handleChangeActionRequest } from "./change-actions-rest.js";

// a-change-is-acted-on-from-its-card (ADR 0044): a standalone card's actions
// run through one route, where the change is worked. A workspace that is not
// a git repository has no worktree of a change's own, so these act in it.
// every-varying-check-has-a-budget: a local HTTP server and temporary files,
// set up inside each test. Measured 2026-10-09 at 0.9 s for the file.
vi.setConfig({ testTimeout: 20_000 });

const TOKEN = "change-action-test-token";
const HEADERS = { "content-type": "application/json", "x-openspec-ui-token": TOKEN };

async function withServer(test: (post: (body: unknown) => Promise<Response>, workspace: string) => Promise<void>): Promise<void> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "openspec-change-action-"));
  for (const name of ["demo", "other"]) {
    const dir = path.join(workspace, "openspec", "changes", name);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "proposal.md"), `# ${name}\n`, "utf8");
    await writeFile(path.join(dir, "tasks.md"), "- [x] 1.1 Read\n- [ ] 1.2 Write\n", "utf8");
  }
  const server = createServer({ workspaceRoot: workspace, host: "127.0.0.1", port: 0, runners: new Map(), accessToken: TOKEN });
  try {
    const address = await server.listen();
    const post = (body: unknown) => fetch(`http://127.0.0.1:${address.port}/api/change-action`, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
    await test(post, workspace);
  } finally {
    await server.close();
    await rm(workspace, { recursive: true, force: true });
  }
}

describe("a change's actions, for the standalone app's cards", () => {
  it("prepares CI repair through authenticated HTTP and retains exact forge diagnostics", async () => {
    await withServer(async (post, workspace) => {
      const exec = promisify(execFile);
      const git = async (...args: string[]) => (await exec("git", [...await gitIsolationArgs(), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", ...args], { cwd: workspace })).stdout.trim();
      await git("init", "-b", "main"); await git("add", "."); await git("commit", "-m", "Fixture");
      await git("switch", "-c", "demo"); await git("remote", "add", "origin", "https://github.com/org/app.git");
      const head = await git("rev-parse", "HEAD");
      const actualFetch = globalThis.fetch.bind(globalThis);
      vi.stubEnv("GITHUB_TOKEN", "ci-repair-fixture");
      const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        if (!url.startsWith("https://api.github.com/repos/org/app")) return actualFetch(input, init);
        const suffix = url.slice("https://api.github.com/repos/org/app".length);
        const values: Record<string, unknown> = {
          "/pulls?state=all&sort=created&direction=desc&per_page=50&page=1": [{ number: 4, state: "open", head: { ref: "demo", sha: head, repo: { id: 1 } }, base: { ref: "main", sha: head, repo: { id: 1 } } }],
          [`/commits/${head}/check-runs?per_page=100`]: { total_count: 1, check_runs: [{ id: 7, name: "tests", status: "completed", conclusion: "failure", output: { annotations_count: 1 } }] },
          [`/commits/${head}/status?per_page=100`]: { total_count: 0, statuses: [] },
          "/rules/branches/main?per_page=100": [], "/branches/main": { protection: { enabled: false } },
          "/check-runs/7/annotations?per_page=10&page=1": [{ annotation_level: "failure", path: "src/test.ts", start_line: 42, message: "Assertion failed" }],
        };
        return new Response(JSON.stringify(values[suffix] ?? {}), { status: suffix in values ? 200 : 404 });
      });
      try {
        const response = await post({ cwd: workspace, changeName: "demo", action: "showPrReview", input: { prReview: { prepareCiRepairTask: true } } });
        expect(response.status).toBe(200);
        const answer = await response.json();
        expect(answer.report.ciRepairTask).toContain("src/test.ts:42: Assertion failed");
        expect(answer.report.ciRepairTask).toContain(head);
        expect(answer.report.summary).toContain("No agent was started");
        expect(fetch.mock.calls.some(([url]) => String(url).includes("/annotations?"))).toBe(true);
        expect(await git("status", "--porcelain")).toBe("");
      } finally { fetch.mockRestore(); vi.unstubAllEnvs(); }
    });
  });

  it.each([{ scenarioMapping: { mode: "save" } }, { junitMapping: { mode: "save" } }, { ciJUnitImport: { head: "a".repeat(40), execution: 7 } }, { reviewFinding: { kind: "add" } },
    { junitImport: { head: "a".repeat(40), testedCommit: "a".repeat(40), xml: "<testsuite/>" } }])("uses the worktree write guard for a PR Review write %j", async (prReview) => {
    const workspace = os.tmpdir();
    const refusal = "The worktree records do not check out.";
    const server = createHttpServer((req, res) => void handleChangeActionRequest(req, res, {
      isCwdAllowed: (root) => root === workspace,
      maxPayloadBytes: 8_192,
    }, {
      resolveRecoveryService: vi.fn(),
      root: async () => ({ root: workspace, changeDir: workspace, ownership: {
        kind: "unverified", label: "demo", path: workspace,
      }, refusal }),
    }));
    try {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const { port } = server.address() as AddressInfo;
      const result = await fetch(`http://127.0.0.1:${port}/api/change-action`, { method: "POST", headers: HEADERS,
        body: JSON.stringify({ cwd: workspace, changeName: "demo", action: "showPrReview",
          input: { prReview } }) });
      expect(result.status).toBe(409);
      expect(await result.json()).toEqual({ error: refusal });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("imports CI JUnit through the authenticated HTTP action with GitLab job provenance", async () => {
    await withServer(async (post, workspace) => {
      const exec = promisify(execFile);
      const git = async (...args: string[]) => (await exec("git", [...await gitIsolationArgs(), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", ...args], { cwd: workspace })).stdout.trim();
      await git("init", "-b", "main"); await git("add", "."); await git("commit", "-m", "Fixture");
      await git("remote", "add", "origin", "https://gitlab.com/team/app.git");
      const head = await git("rev-parse", "HEAD");
      const actualFetch = globalThis.fetch.bind(globalThis);
      const api = "https://gitlab.com/api/v4/projects/team%2Fapp";
      vi.stubEnv("GITLAB_TOKEN", "ci-junit-fixture");
      const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        if (!url.startsWith(api)) return actualFetch(input, init);
        const suffix = url.slice(api.length);
        if (suffix === "/jobs/7") return Response.json({ id: 7, commit: { id: head }, pipeline: { id: 33, sha: head } });
        if (suffix === "/jobs/7/artifacts/tested-commit.txt") return new Response(head);
        if (suffix === "/jobs/7/artifacts/junit.xml") return new Response('<testsuite><testcase name="expiry"/></testsuite>');
        if (suffix.startsWith("/merge_requests?")) return Response.json([]);
        return new Response(null, { status: 404 });
      });
      try {
        const result = await post({ cwd: workspace, changeName: "demo", action: "showPrReview",
          input: { prReview: { ciJUnitImport: { head, execution: 7 } } } });
        expect(result.status).toBe(200);
        const { report } = await result.json();
        expect(report.ciJUnitForge).toBe("GitLab");
        expect(report.summary).toContain("job #7, pipeline #33");
        expect(report.summary).toContain(head);
        expect(await git("status", "--porcelain")).toBe("");
      } finally { fetch.mockRestore(); vi.unstubAllEnvs(); }
    });
  }, 45_000);

  it("imports JUnit through authenticated HTTP and previews and saves a testcase association", async () => {
    await withServer(async (post, workspace) => {
      const exec = promisify(execFile);
      const git = async (...args: string[]) => (await exec("git", [...await gitIsolationArgs(), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", ...args], { cwd: workspace })).stdout.trim();
      const directory = path.join(workspace, "openspec", "changes", "demo");
      await mkdir(path.join(directory, "specs", "auth"), { recursive: true });
      await writeFile(path.join(directory, "specs", "auth", "spec.md"), "## ADDED Requirements\n### Requirement: Session\n#### Scenario: Expiry\n");
      await writeFile(path.join(directory, "scenario-tests.json"), JSON.stringify({ scenarios: [{ capability: "auth", requirement: "Session", scenario: "Expiry", tests: [{ classname: "Session", name: "expires" }] }] }));
      await git("init", "-b", "main"); await git("add", "."); await git("commit", "-m", "Fixture");
      const head = await git("rev-parse", "HEAD");
      const reply = await post({ cwd: workspace, changeName: "demo", action: "showPrReview", input: { prReview: { junitImport: {
        head, testedCommit: head, xml: '<testsuite><testcase classname="Session" name="expires"><skipped/></testcase><testcase name="other expiry"/></testsuite>',
      } } } });
      expect(reply.status).toBe(200);
      const result = await reply.json();
      expect(result.report.summary).toContain("User-declared tested commit");
      expect(result.report.summary).toContain("expires `: skipped");
      const choices = result.report.junitMappingChoices;
      const test = { classname: "", name: "other expiry" };
      const selection = { head, reportId: choices.reportId, scenario: choices.scenarios[0], test };
      const request = (junitMapping: unknown) => post({ cwd: workspace, changeName: "demo", action: "showPrReview", input: { prReview: { junitMapping } } });
      const preview = await request({ mode: "preview", selection });
      expect(preview.status).toBe(200);
      const { revision, diff } = (await preview.json()).report.junitMappingPreview;
      expect(diff).toContain(test.name);
      expect(await git("status", "--porcelain")).toBe("");
      const saved = await request({ mode: "save", selection, revision });
      expect(saved.status).toBe(200);
      expect((await saved.json()).report.summary).toContain("Test mapping saved");
      expect(JSON.parse(await readFile(path.join(directory, "scenario-tests.json"), "utf8")).scenarios[0].tests)
        .toEqual([{ classname: "Session", name: "expires" }, test]);
    });
  }, 45_000);

  it("returns the PR review and preserves unavailable comparison and evidence", async () => {
    await withServer(async (post, workspace) => {
      const response = await post({ cwd: workspace, changeName: "demo", action: "showPrReview" });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        kind: "pr-review",
        report: { title: "PR Review for demo", diff: null, summary: expect.stringContaining("Mechanical checks: no result recorded") },
      });
    });
  });

  it("adds a relation the person picked, after naming the ones there are to pick", async () => {
    await withServer(async (post, workspace) => {
      const offered = await post({ cwd: workspace, changeName: "demo", action: "addRelation" });
      expect(offered.status).toBe(200);
      expect(await offered.json()).toEqual({ kind: "relations", keys: ["follows", "supersedes", "blocked_by"], changes: ["other"], stated: [] });

      const added = await post({ cwd: workspace, changeName: "demo", action: "addRelation", input: { relation: { key: "follows", id: "other" } } });
      expect(await added.json()).toEqual({ kind: "done", message: "demo now states follows other." });
      expect(await readFile(path.join(workspace, "openspec", "changes", "demo", ".openspec.yaml"), "utf8")).toContain("other");

      const graph = await post({ cwd: workspace, changeName: "other", action: "showGraph" });
      expect(await graph.json()).toMatchObject({ kind: "report", title: "Show Graph other", markdown: "- demo follows other" });
    });
  });

  it("says what a change follows, and what its harness cannot do", async () => {
    await withServer(async (post, workspace) => {
      const ancestry = await post({ cwd: workspace, changeName: "demo", action: "showAncestry" });
      expect(await ancestry.json()).toMatchObject({ kind: "report", markdown: "demo follows nothing. An absent relation is not a defect." });
      const explained = await post({ cwd: workspace, changeName: "demo", action: "explainChangeHarness" });
      expect(await explained.json()).toMatchObject({ kind: "report", title: "Explain Change Harness demo" });
    });
  });

  it("deletes a change the card confirmed", async () => {
    await withServer(async (post, workspace) => {
      const response = await post({ cwd: workspace, changeName: "other", action: "deleteChange" });
      expect(await response.json()).toEqual({ kind: "done", message: "Deleted other." });
      expect(existsSync(path.join(workspace, "openspec", "changes", "other"))).toBe(false);
    });
  });

  it("refuses what is done in the page, what needs a run, and an unknown action", async () => {
    await withServer(async (post, workspace) => {
      expect((await post({ cwd: workspace, changeName: "demo", action: "configureChangeHarness" })).status).toBe(400);
      expect((await post({ cwd: workspace, changeName: "demo", action: "deleteWorkspace" })).status).toBe(400);
      const stop = await post({ cwd: workspace, changeName: "demo", action: "stopRun", input: { stop: { reason: "enough" } } });
      expect(stop.status).toBe(409);
      expect((await stop.json() as { error: string }).error).toContain("nothing is running on demo");
      const open = await post({ cwd: workspace, changeName: "demo", action: "openWorktree" });
      expect(open.status).toBe(409);
      // Never committed in the checkout: only in a change's own worktree
      // (a-change-is-committed-where-it-is-made).
      const commit = await post({ cwd: workspace, changeName: "demo", action: "commitChange" });
      expect(commit.status).toBe(409);
      expect((await commit.json() as { error: string }).error).toMatch(/^OSW-GIT-001: demo has no worktree of its own/u);
    });
  });

  it("refuses a cwd outside the workspace, as every route does", async () => {
    await withServer(async (post) => {
      expect((await post({ cwd: os.tmpdir(), changeName: "demo", action: "showGraph" })).status).toBe(403);
    });
  });
});
