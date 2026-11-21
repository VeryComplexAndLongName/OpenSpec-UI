import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import type { createWorkbenchServer } from "@openspec-ui/server";
import { openWorkbenchCommand } from "./open-workbench.js";

// Temporary filesystem fixtures measured 0.26s for this file; allow a loaded host.
vi.setConfig({ testTimeout: 10_000, hookTimeout: 10_000 });
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, maxRetries: 5, retryDelay: 100 }); });
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "osw-launcher-unit-")); roots.push(root);
  const assets = path.join(root, "assets"); await mkdir(assets);
  for (const file of ["index.html", "app.js"]) await writeFile(path.join(assets, file), "fixture");
  await writeFile(path.join(assets, "versions.json"), JSON.stringify({ core: "1.2.3", server: "4.5.6" }));
  const server = { accessToken: "fixture-token", httpServer: createHttpServer(),
    listen: vi.fn(async () => ({ address: "127.0.0.1", family: "IPv4", port: 4318 })), close: vi.fn(async () => undefined) };
  const createServer = vi.fn(() => server);
  const out: string[] = [], err: string[] = [];
  return { root, assets, server, createServer, deps: { assetRoot: assets, createServer: createServer as unknown as typeof createWorkbenchServer, untilStopped: async () => undefined }, io: { stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) }, out, err };
}

it("launches the existing host with packaged assets and exact metadata then closes after a stop", async () => {
  const f = await fixture();
  expect(await openWorkbenchCommand({ workspaceRoot: f.root, port: "0", format: "json" }, f.io, f.deps)).toBe(0);
  expect(f.createServer).toHaveBeenCalledWith(expect.objectContaining({ workspaceRoot: f.root, port: 0, allowExternalCwd: false, versions: { core: "1.2.3", server: "4.5.6" }, staticAssets: expect.objectContaining({ appJsPath: path.join(f.assets, "app.js") }) }));
  expect(JSON.parse(f.out[0]!)).toEqual({ url: "http://127.0.0.1:4318/#token=fixture-token", workspaceRoot: f.root, versions: { core: "1.2.3", server: "4.5.6" } });
  expect(f.server.close).toHaveBeenCalledOnce(); expect(f.err).toEqual([]);
});

it.each(["-1", "65536", "1.5", "NaN", "1e3", "", "--host"])("refuses port %j before creating a host", async (port) => {
  const f = await fixture();
  expect(await openWorkbenchCommand({ workspaceRoot: f.root, port, format: "text" }, f.io, f.deps)).toBe(2);
  expect(f.createServer).not.toHaveBeenCalled(); expect(f.out).toEqual([]);
  expect(f.err.join("\n")).toContain("--port must be an integer");
});

it("refuses missing/file cwd and damaged package metadata before listening", async () => {
  const f = await fixture();
  for (const cwd of [path.join(f.root, "missing"), path.join(f.assets, "app.js")]) expect(await openWorkbenchCommand({ workspaceRoot: cwd, format: "text" }, f.io, f.deps)).toBe(2);
  await writeFile(path.join(f.assets, "versions.json"), "{}");
  expect(await openWorkbenchCommand({ workspaceRoot: f.root, format: "text" }, f.io, f.deps)).toBe(2);
  expect(f.createServer).not.toHaveBeenCalled();
});

it("reports occupied-port listen rejection with exit 2 and cleans up the host", async () => {
  const f = await fixture(); f.server.listen.mockRejectedValueOnce(Error("EADDRINUSE"));
  expect(await openWorkbenchCommand({ workspaceRoot: f.root, format: "text" }, f.io, f.deps)).toBe(2);
  expect(f.server.close).toHaveBeenCalledOnce(); expect(f.out).toEqual([]);
  expect(f.err[0]).toContain("EADDRINUSE");
});
