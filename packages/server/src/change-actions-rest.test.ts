import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createServer } from "./server.js";

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
    });
  });

  it("refuses a cwd outside the workspace, as every route does", async () => {
    await withServer(async (post) => {
      expect((await post({ cwd: os.tmpdir(), changeName: "demo", action: "showGraph" })).status).toBe(403);
    });
  });
});
