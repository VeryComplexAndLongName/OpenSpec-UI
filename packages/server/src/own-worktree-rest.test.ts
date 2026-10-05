import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createServer } from "./server.js";

// a-card-works-its-own-tasks 3.1. The rules are core's (resolving the own
// worktree, the note, the run check); these routes read a body, check the
// cwd as every route does, and answer what core said. A workspace that is
// not a git repository has no worktree of a change's own, which is the one
// fact these assert without starting git.
// every-varying-check-has-a-budget: a local HTTP server and temporary files,
// set up inside each test rather than in a hook. Measured 2026-10-05 at
// 718 ms for the four tests.
vi.setConfig({ testTimeout: 20_000 });

const TOKEN = "own-worktree-test-token";
const HEADERS = { "content-type": "application/json", "x-openspec-ui-token": TOKEN };

/** A workspace with one change and its task list, and a server on it, for
 * the length of one test. */
async function withServer(test: (post: (route: string, body: unknown) => Promise<Response>, workspace: string) => Promise<void>): Promise<void> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "openspec-own-rest-"));
  const dir = path.join(workspace, "openspec", "changes", "demo");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "tasks.md"), "- [ ] 1.1 **Human-only**: look\n  closely.\n", "utf8");
  const server = createServer({ workspaceRoot: workspace, host: "127.0.0.1", port: 0, runners: new Map(), accessToken: TOKEN });
  try {
    const address = await server.listen();
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${address.port}${route}`, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
    await test(post, workspace);
  } finally {
    await server.close();
    await rm(workspace, { recursive: true, force: true });
  }
}

describe("the routes a card's task controls use", () => {
  it("reads a change's tasks whole, from this checkout where it has no worktree of its own", async () => {
    await withServer(async (post, workspace) => {
      const response = await post("/api/change-tasks", { cwd: workspace, changeName: "demo" });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        ok: true,
        source: "this-checkout",
        rows: [{ number: "1.1", lineNumber: 0, body: "closely.", closedBy: "person" }],
      });
    });
  });

  it("refuses to tick, commit or run in a change with no worktree of its own, and writes nothing", async () => {
    await withServer(async (post, workspace) => {
      for (const [route, extra] of [
        ["/api/change-tasks/set", { lineNumber: 0, expectedText: "1.1 **Human-only**: look", done: true, note: "seen" }],
        ["/api/change-tasks/commit", {}],
        ["/api/change-tasks/run", { lineNumber: 0 }],
      ] as const) {
        const response = await post(route, { cwd: workspace, changeName: "demo", ...extra });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ ok: false, kind: "no-worktree" });
      }
    });
  });

  it("refuses a body without a change, or without the line a tick names", async () => {
    await withServer(async (post, workspace) => {
      expect((await post("/api/change-tasks", { cwd: workspace })).status).toBe(400);
      expect((await post("/api/change-tasks/set", { cwd: workspace, changeName: "demo", done: true })).status).toBe(400);
      expect((await post("/api/change-tasks/run", { cwd: workspace, changeName: "demo" })).status).toBe(400);
    });
  });

  it("refuses a cwd outside the workspace, as every route does", async () => {
    await withServer(async (post) => {
      const response = await post("/api/change-tasks", { cwd: os.tmpdir(), changeName: "demo" });
      expect(response.status).toBe(403);
    });
  });
});
