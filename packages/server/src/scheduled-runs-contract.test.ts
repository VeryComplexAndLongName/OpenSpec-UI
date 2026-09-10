// Contract test between `webui` and `server` for `/api/scheduled-runs`
// (a-name-is-checked-before-it-is-used, task 4.5).
//
// The route's accepted body changed: it now refuses an entry the reader
// would discard, and refuses a body carrying both an addition and a
// removal. That makes the shell's client and the route two halves of
// one agreement, and a test asserting the route alone would keep
// passing while the client sent something the route no longer takes.
//
// So the real client drives the real server here — no hand-written
// bodies on either side. `packages/webui/src/scheduled-runs-client.ts`
// is pure over a `request` function, which is what lets it be pointed
// at a live HTTP server from a Node test.

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addScheduledRun,
  loadScheduledRuns,
  removeScheduledRun,
  type ScheduledRun,
} from "@openspec-ui/webui/src/scheduled-runs-client.js";
import { createServer, type OpenSpecUiServer } from "./server.js";

// suite-survives-a-loaded-machine: starts a real HTTP server and writes
// a file under a temporary directory, so its cost varies with the
// machine. Measured 2026-09-10 at well under a second for the file;
// sized far above that so a loaded machine does not fail it.
import { vi } from "vitest";
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const ACCESS_TOKEN = "scheduled-runs-contract-token";

let server: OpenSpecUiServer;
let baseUrl: string;
let cwd: string;

beforeEach(async () => {
  server = createServer({
    workspaceRoot: "/workspace/repo",
    host: "127.0.0.1",
    port: 0,
    runners: new Map(),
    accessToken: ACCESS_TOKEN,
    allowExternalCwd: true,
  });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
  cwd = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-schedule-contract-"));
});

afterEach(async () => {
  await server?.close();
  await rm(cwd, { recursive: true, force: true });
});

/** What the shell's client is given in the browser: a function that
 * takes a pathname and the init it built, and returns the response.
 * Pointed at the live server rather than at a stub, which is the whole
 * point of this file. */
function request(pathname: string, init: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), "x-openspec-ui-token": ACCESS_TOKEN },
  });
}

const entry: ScheduledRun = {
  changeName: "demo",
  path: "chain",
  startAt: "2026-09-09T18:00:00.000Z",
  requestedAt: "2026-09-09T12:00:00.000Z",
};

describe("the schedule route and the shell's client agree", () => {
  it("accepts what the client sends, and reads the same entry back", async () => {
    expect(await addScheduledRun(request, cwd, entry)).toEqual([entry]);
    expect(await loadScheduledRuns(request, cwd)).toEqual([entry]);
  });

  it("removes through the client what the client added", async () => {
    await addScheduledRun(request, cwd, entry);

    expect(await removeScheduledRun(request, cwd, entry)).toEqual([]);
    expect(await loadScheduledRuns(request, cwd)).toEqual([]);
  });

  it("never asks for an addition and a removal in one request", async () => {
    // The route refuses a body carrying both, so this is the half of
    // the agreement the client has to keep. Read off the bodies it
    // actually sends rather than asserted about its source.
    const bodies: Array<Record<string, unknown>> = [];
    const record = (pathname: string, init: RequestInit): Promise<Response> => {
      bodies.push(JSON.parse(init.body as string) as Record<string, unknown>);
      return request(pathname, init);
    };

    await addScheduledRun(record, cwd, entry);
    await removeScheduledRun(record, cwd, entry);
    await loadScheduledRuns(record, cwd);

    for (const body of bodies) {
      expect(body.add === undefined || body.remove === undefined).toBe(true);
    }
  });

  it("surfaces the route's refusal to the client as an error naming the field", async () => {
    // The client throws with the server's own message, so a body the
    // route no longer accepts is visible in the shell rather than
    // silently doing nothing.
    await expect(addScheduledRun(request, cwd, { ...entry, startAt: "tomorrow-ish" }))
      .rejects.toThrow(/startAt/u);
    expect(await loadScheduledRuns(request, cwd)).toEqual([]);
  });
});
