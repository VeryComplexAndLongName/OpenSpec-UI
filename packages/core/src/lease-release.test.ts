import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { releaseWorkspaceLease } from "./lease-release.js";
import { WORKSPACE_LEASE_VERSION, type WorkspaceLeaseDocument } from "./workspace-lease.js";

// every-varying-check-has-a-budget:
// measured 2026-09-11 for this file alone at 0.3s idle, its slowest
// single test being the one that waits for a real child to exit.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-release-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function leasePath(root: string): string {
  return path.join(root, ".openspec-ui", "workspace.lease.json");
}

async function writeLease(root: string, overrides: Partial<WorkspaceLeaseDocument>): Promise<void> {
  const now = new Date().toISOString();
  const document: WorkspaceLeaseDocument = {
    version: WORKSPACE_LEASE_VERSION,
    holderId: "holder-1",
    hostKind: "cli",
    hostname: os.hostname(),
    pid: process.pid,
    acquiredAt: now,
    heartbeatAt: now,
    ...overrides,
  };
  await mkdir(path.dirname(leasePath(root)), { recursive: true });
  await writeFile(leasePath(root), JSON.stringify(document, null, 2), "utf8");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** A pid that is certainly not running, established rather than assumed.
 *
 * Picking a large number and hoping would make this test pass for the
 * wrong reason on a machine that happened to have it. Spawning something
 * and waiting for it to exit is the only way to know. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  const pid = child.pid;
  if (pid === undefined) throw new Error("could not spawn a process to exhaust");
  await new Promise<void>((resolve) => child.on("exit", () => resolve()));
  return pid;
}

describe("releaseWorkspaceLease", () => {
  it("clears a stale lease without consulting any process", async () => {
    const root = await temporaryRoot();
    await writeLease(root, { heartbeatAt: new Date(Date.now() - 60_000).toISOString() });
    const isRunning = vi.fn(() => true);

    const outcome = await releaseWorkspaceLease({ workspaceRoot: root, isRunning });

    expect(outcome).toEqual({ kind: "cleared", because: "stale" });
    // Staleness is what this system has always meant by a holder being
    // gone, so no liveness question arises at all.
    expect(isRunning).not.toHaveBeenCalled();
    expect(await exists(leasePath(root))).toBe(false);
  });

  it("reports a workspace that was never held", async () => {
    const root = await temporaryRoot();

    const outcome = await releaseWorkspaceLease({ workspaceRoot: root });

    expect(outcome).toEqual({ kind: "cleared", because: "already-free" });
  });

  it("refuses a holder whose process is still running", async () => {
    const root = await temporaryRoot();
    // This test's own pid, which is certainly alive.
    await writeLease(root, { pid: process.pid, author: "ada@example.com" });

    const outcome = await releaseWorkspaceLease({ workspaceRoot: root });

    expect(outcome.kind).toBe("refused");
    if (outcome.kind === "refused") {
      expect(outcome.holder.author).toBe("ada@example.com");
      expect(outcome.reason).toContain("still running");
      // The remedy is stopping it, not taking its lease.
      expect(outcome.reason).toContain("stop that process");
    }
    expect(await exists(leasePath(root))).toBe(true);
  });

  it("refuses a holder on another machine, saying it cannot be checked", async () => {
    const root = await temporaryRoot();
    await writeLease(root, { hostname: "some-other-box", pid: 4242 });
    const isRunning = vi.fn(() => false);

    const outcome = await releaseWorkspaceLease({ workspaceRoot: root, isRunning });

    expect(outcome.kind).toBe("refused");
    if (outcome.kind === "refused") {
      expect(outcome.reason).toContain("some-other-box");
      expect(outcome.reason).toContain("cannot be checked from here");
    }
    // A pid on another machine says nothing about a process on this one,
    // so it is never even asked about.
    expect(isRunning).not.toHaveBeenCalled();
    expect(await exists(leasePath(root))).toBe(true);
  });

  it("clears a lease whose holder on this machine has gone", async () => {
    const root = await temporaryRoot();
    await writeLease(root, { pid: await deadPid(), author: "ada@example.com" });

    const outcome = await releaseWorkspaceLease({ workspaceRoot: root });

    expect(outcome.kind).toBe("cleared");
    if (outcome.kind === "cleared") {
      expect(outcome.because).toBe("process-gone");
      expect(outcome.holder?.author).toBe("ada@example.com");
    }
    expect(await exists(leasePath(root))).toBe(false);
  });
});
