// Focused contract for the detached-process recovery routes (ADR 0050):
// the ledger list is served read-only, and termination refuses a snapshot
// whose identity cannot be re-verified. No real process is killed here — the
// PID is fake, so the start-time re-verification fails before any terminator
// runs (which is the safety the test asserts).

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { commandLineHash, defaultProcessLedger, setProcessLedgerStateRoot } from "@openspec-ui/core";
import { createServer, type OpenSpecUiServer } from "./server.js";

vi.setConfig({ testTimeout: 20_000 });

const TOKEN = "ledger-rest-token";
const HEADERS = { "content-type": "application/json", "x-openspec-ui-token": TOKEN };
const directories: string[] = [];
afterEach(async () => {
  setProcessLedgerStateRoot(undefined);
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});

it("lists detached snapshots and refuses an unverifiable termination", async () => {
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), "ledger-rest-state-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "ledger-rest-workspace-"));
  directories.push(stateRoot, workspace);

  setProcessLedgerStateRoot(stateRoot);
  const ledger = defaultProcessLedger(workspace);
  expect(ledger).toBeDefined();
  ledger!.record({
    runId: "run-orphan", pid: 999999, executablePath: "/usr/bin/claude", hostname: os.hostname(),
    cwd: workspace, commandLineHash: commandLineHash("claude", ["-p"]), spawnedAt: "2026-10-11T09:00:00.000Z",
  });

  let server: OpenSpecUiServer | undefined;
  try {
    server = createServer({ workspaceRoot: workspace, host: "127.0.0.1", port: 0, accessToken: TOKEN });
    const address = await server.listen();
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${address.port}${route}`, {
      method: "POST", headers: HEADERS, body: JSON.stringify(body),
    });

    const list = await post("/api/processes/ledger", { cwd: workspace });
    expect(list.status).toBe(200);
    const readings = await list.json() as Array<{ runId: string; pid: number; orphan: boolean }>;
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({ runId: "run-orphan", pid: 999999 });

    const unknown = await post("/api/processes/terminate", { cwd: workspace, runId: "missing", pid: 1 });
    expect(unknown.status).toBe(409);

    // No start time recorded for this fake PID, so re-verification refuses
    // before any process-tree kill is attempted.
    const refused = await post("/api/processes/terminate", { cwd: workspace, runId: "run-orphan", pid: 999999 });
    expect(refused.status).toBe(409);
    const body = await refused.json() as { error: string };
    expect(body.error).toContain("start time");
  } finally {
    await server?.close();
  }
});
