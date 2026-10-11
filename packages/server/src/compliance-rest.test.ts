import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { createServer } from "./server.js";

vi.setConfig({ testTimeout: 20_000 });
it("carries cache-only readings and rejects unauthorized/outside-workspace requests", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "compliance-rest-"));
  const token = "compliance-contract-token";
  const server = createServer({ workspaceRoot: root, host: "127.0.0.1", port: 0, runners: new Map(), accessToken: token });
  try {
    const address = await server.listen();
    const post = (body: unknown, authenticated = true) => fetch(`http://127.0.0.1:${address.port}/api/compliance`, {
      method: "POST", headers: { "content-type": "application/json", ...(authenticated ? { "x-openspec-ui-token": token } : {}) }, body: JSON.stringify(body),
    });
    const response = await post({ cwd: root, op: "read" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ generation: 0, observations: [], policy: { backgroundEnabled: false } });
    expect((await post({ cwd: root, op: "read" }, false)).status).toBe(401);
    expect((await post({ cwd: os.tmpdir(), op: "read" })).status).toBe(403);
    expect((await post({ cwd: root, op: "sweep" })).status).toBe(409);
    expect((await post({ cwd: root, op: "repair", ruleId: "sweep-result", subject: root })).status).toBe(409);
  } finally { await server.close(); await rm(root, { recursive: true, force: true }); }
});