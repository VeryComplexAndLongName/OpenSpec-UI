import { createServer, type Server } from "node:http";
import { getGlobalDispatcher, ProxyAgent, setGlobalDispatcher } from "undici";
import { afterEach, describe, expect, it } from "vitest";
import { localFetch, withoutSystemProxy } from "./direct-fetch.js";

// local-llm-codes-in-process 4.1-4.2.
let server: Server | undefined;
afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe("localFetch", () => {
  it("goes direct even where the process's fetch has been sent through a proxy, as the editor host does", async () => {
    server = createServer((_req, res) => { res.writeHead(200); res.end("direct"); });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const previous = getGlobalDispatcher();
    // A proxy that answers nothing, installed for the whole process.
    setGlobalDispatcher(new ProxyAgent("http://127.0.0.1:9"));
    try {
      await expect(localFetch(false)(`http://127.0.0.1:${port}/`)).rejects.toThrow();
      expect(await (await localFetch(true)(`http://127.0.0.1:${port}/`)).text()).toBe("direct");
    } finally {
      setGlobalDispatcher(previous);
    }
  });

  it("reaches the server directly when told to ignore the system proxy, whatever the proxy variables say", async () => {
    server = createServer((_req, res) => { res.writeHead(200); res.end("direct"); });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const saved = { HTTP_PROXY: process.env.HTTP_PROXY, HTTPS_PROXY: process.env.HTTPS_PROXY, NO_PROXY: process.env.NO_PROXY };
    // A proxy that answers nothing: a request through it would fail.
    process.env.HTTP_PROXY = "http://127.0.0.1:9";
    process.env.HTTPS_PROXY = "http://127.0.0.1:9";
    delete process.env.NO_PROXY;
    try {
      const response = await localFetch(true)(`http://127.0.0.1:${port}/`);
      expect(await response.text()).toBe("direct");
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("is the process's own fetch otherwise", async () => {
    server = createServer((_req, res) => { res.writeHead(200); res.end("ok"); });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    expect(await (await localFetch(false)(`http://127.0.0.1:${port}/`)).text()).toBe("ok");
  });
});

describe("withoutSystemProxy", () => {
  it("removes every proxy variable in either case and sets NO_PROXY=*", () => {
    expect(withoutSystemProxy({ PATH: "p", HTTP_PROXY: "a", https_proxy: "b", All_Proxy: "c", no_proxy: "localhost" })).toEqual({
      PATH: "p",
      NO_PROXY: "*",
      no_proxy: "*",
    });
  });
});
