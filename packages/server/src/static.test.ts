// 2.1 Проверка, что браузерный шелл (index.html + собранный app.js)
// реально отдаётся сервером по фиксированным путям.

import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AgentRunner } from "@openspec-ui/core";
import { clientBuildOptions } from "../scripts/client-build-options.mjs";
import { createServer, type OpenSpecUiServer } from "./server.js";

let server: OpenSpecUiServer;
let baseUrl: string;

beforeAll(async () => {
  // Гарантирует наличие dist/app.js для этого тестового прогона независимо
  // от того, был ли уже вручную вызван `npm run build`.
  await build(clientBuildOptions());
}, 30_000);

afterAll(async () => {
  await server?.close();
});

async function startServer() {
  server = createServer({
    workspaceRoot: "/workspace/repo",
    host: "127.0.0.1",
    port: 0,
    runners: new Map<string, AgentRunner>(),
  });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
}

describe("server — static browser shell", () => {
  beforeAll(async () => {
    await startServer();
  });

  it("serves index.html at /", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain('<div id="root">');
    expect(body).toContain('src="/app.js"');
  });

  it("serves index.html at / with a query string (VS Code local-server embed)", async () => {
    const res = await fetch(`${baseUrl}/?embed=vscode-local-server`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain('<div id="root">');
  });

  it("serves the bundled app.js", async () => {
    const res = await fetch(`${baseUrl}/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown paths", async () => {
    const res = await fetch(`${baseUrl}/does-not-exist`);
    expect(res.status).toBe(404);
  });
});

describe("server — static browser shell with explicit staticAssets override", () => {
  it("serves from the overridden paths instead of the import.meta.url-relative defaults", async () => {
    const overrideServer = createServer({
      workspaceRoot: "/workspace/repo",
      host: "127.0.0.1",
      port: 0,
      runners: new Map<string, AgentRunner>(),
      staticAssets: {
        indexHtmlPath: new URL("../public/index.html", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
      },
    });
    const address = await overrideServer.listen();
    try {
      const res = await fetch(`http://127.0.0.1:${address.port}/`);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('<div id="root">');
    } finally {
      await overrideServer.close();
    }
  });

  it("returns 404 with a helpful message when an overridden path does not exist", async () => {
    const overrideServer = createServer({
      workspaceRoot: "/workspace/repo",
      host: "127.0.0.1",
      port: 0,
      runners: new Map<string, AgentRunner>(),
      staticAssets: { indexHtmlPath: "/does/not/exist/index.html" },
    });
    const address = await overrideServer.listen();
    try {
      const res = await fetch(`http://127.0.0.1:${address.port}/`);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("index.html");
    } finally {
      await overrideServer.close();
    }
  });
});
