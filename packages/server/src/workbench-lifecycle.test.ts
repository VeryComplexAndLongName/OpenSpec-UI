import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { createServer, type OpenSpecUiServer } from "./server.js";

// Real loopback HTTP/WS and a temporary root; no agent or external service.
vi.setConfig({ testTimeout: 15_000, hookTimeout: 15_000 });
const roots: string[] = [], servers: OpenSpecUiServer[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close().catch(() => undefined);
  for (const root of roots.splice(0)) await rm(root, { recursive: true, maxRetries: 10, retryDelay: 100 });
});
async function fixture(port = 0) {
  const root = await mkdtemp(path.join(os.tmpdir(), "osw-host-lifecycle-")); roots.push(root);
  const server = createServer({ workspaceRoot: root, host: "127.0.0.1", port, runners: new Map(), versions: { core: "1.2.3", server: "4.5.6" } }); servers.push(server);
  return server;
}

it("serves exact embedded build versions only after authentication", async () => {
  const server = await fixture(), address = await server.listen();
  expect(address.address).toBe("127.0.0.1");
  const url = `http://127.0.0.1:${address.port}/api/versions`;
  expect((await fetch(url)).status).toBe(401);
  const response = await fetch(url, { headers: { "x-openspec-ui-token": server.accessToken } });
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ core: "1.2.3", server: "4.5.6" });
});

it("rejects the original occupied-port error instead of emitting an unhandled error", async () => {
  const occupied = createNetServer(); occupied.listen(0, "127.0.0.1"); await once(occupied, "listening");
  try {
    const server = await fixture((occupied.address() as import("node:net").AddressInfo).port);
    await expect(server.listen()).rejects.toMatchObject({ code: "EADDRINUSE" });
  } finally { await new Promise<void>((resolve) => occupied.close(() => resolve())); }
});

it("closes an authenticated open browser socket and the HTTP listener", async () => {
  const server = await fixture(), address = await server.listen();
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/ws`, ["openspec-ui", `openspec-ui-token.${server.accessToken}`], { origin: `http://127.0.0.1:${address.port}` });
  socket.on("error", () => {}); await once(socket, "open");
  const closed = once(socket, "close"); await server.close(); await closed;
  expect(socket.readyState).toBe(WebSocket.CLOSED); expect(server.httpServer.listening).toBe(false);
});
