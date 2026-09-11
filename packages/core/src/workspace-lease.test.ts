import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WORKSPACE_LEASE_VERSION,
  WorkspaceLeaseManager,
  describeWorkspaceLeaseConflict,
  describeWorkspaceLeaseReclamation,
  withWorkspaceLease,
  type WorkspaceLeaseDocument,
} from "./workspace-lease.js";

// every-varying-check-has-a-budget:
// measured 2026-09-05 for this file alone at 0.1s idle and 1.8s
// under deliberate 8-worker CPU co-load, for its slowest single test.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-lease-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function readLease(root: string): Promise<WorkspaceLeaseDocument> {
  const raw = await readFile(path.join(root, ".openspec-ui", "workspace.lease.json"), "utf8");
  return JSON.parse(raw) as WorkspaceLeaseDocument;
}

describe("WorkspaceLeaseManager", () => {
  it("acquires the lease when none exists", async () => {
    const root = await temporaryRoot();
    const manager = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });

    const result = await manager.acquireOrRenew();

    expect(result).toEqual({ ok: true });
    const document = await readLease(root);
    expect(document).toMatchObject({ version: WORKSPACE_LEASE_VERSION, hostKind: "standalone-server" });
  });

  it("renews its own lease, keeping the original acquiredAt", async () => {
    const root = await temporaryRoot();
    const manager = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });

    await manager.acquireOrRenew();
    const first = await readLease(root);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const renewResult = await manager.acquireOrRenew();
    const second = await readLease(root);

    expect(renewResult).toEqual({ ok: true });
    expect(second.acquiredAt).toBe(first.acquiredAt);
    expect(Date.parse(second.heartbeatAt)).toBeGreaterThanOrEqual(Date.parse(first.heartbeatAt));
  });

  it("refuses a live foreign holder", async () => {
    const root = await temporaryRoot();
    const holder = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    await holder.acquireOrRenew();
    const contender = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });

    const result = await contender.acquireOrRenew();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflict).toMatchObject({ hostKind: "standalone-server", pid: process.pid });
      expect(describeWorkspaceLeaseConflict(result.conflict)).toContain("standalone server");
    }
  });

  it("reclaims a stale foreign holder and discloses the reclamation", async () => {
    const root = await temporaryRoot();
    const holder = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    await holder.acquireOrRenew();
    await new Promise((resolve) => setTimeout(resolve, 5));
    // Staleness is judged by the *evaluating* manager's own threshold, not
    // the original holder's — the contender is the one configured short here.
    const contender = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension", staleAfterMs: 1 });

    const result = await contender.acquireOrRenew();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reclaimedFrom).toMatchObject({ hostKind: "standalone-server" });
      expect(describeWorkspaceLeaseReclamation(result.reclaimedFrom!)).toContain("Reclaimed");
    }
    const document = await readLease(root);
    expect(document.hostKind).toBe("vscode-extension");
  });

  it("releases only when self-held", async () => {
    const root = await temporaryRoot();
    const holder = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    await holder.acquireOrRenew();
    const contender = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });

    await contender.release();
    expect(await readLease(root)).toMatchObject({ hostKind: "standalone-server" });

    await holder.release();
    await expect(readFile(path.join(root, ".openspec-ui", "workspace.lease.json"), "utf8")).rejects.toThrow();
  });

  it("acquires cleanly after a release, with no staleness wait", async () => {
    const root = await temporaryRoot();
    const holder = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    await holder.acquireOrRenew();
    await holder.release();

    const next = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });
    const result = await next.acquireOrRenew();

    expect(result).toEqual({ ok: true });
  });
});

describe("a terminal run as a lease holder", () => {
  it("names the terminal run in a conflict, rather than the standalone server", () => {
    // The label was a ternary while there were two kinds, so a third one
    // read as "standalone server" — a wrong answer plausible enough to
    // survive. This is the test that fails if it goes back to one.
    const message = describeWorkspaceLeaseConflict({
      hostKind: "cli",
      hostname: "build-agent-2",
      pid: 4242,
      heartbeatAgeMs: 3_000,
    });

    expect(message).toContain("terminal run on build-agent-2");
    expect(message).not.toContain("standalone server");
  });

  it("names every host kind it can be told about", () => {
    for (const [hostKind, label] of [
      ["cli", "terminal run"],
      ["vscode-extension", "VS Code extension"],
      ["standalone-server", "standalone server"],
    ] as const) {
      expect(describeWorkspaceLeaseReclamation({ hostKind, hostname: "h", pid: 1, heartbeatAgeMs: 0 }))
        .toContain(label);
    }
  });

  it("takes the lease as its own kind of host", async () => {
    const root = await temporaryRoot();
    await new WorkspaceLeaseManager(root, { hostKind: "cli" }).acquireOrRenew();

    expect(await readLease(root)).toMatchObject({ hostKind: "cli" });
  });
});

describe("withWorkspaceLease", () => {
  it("holds the lease for the body and releases it afterwards", async () => {
    const root = await temporaryRoot();
    const lease = new WorkspaceLeaseManager(root, { hostKind: "cli" });

    const outcome = await withWorkspaceLease(lease, async () => {
      expect(await readLease(root)).toMatchObject({ hostKind: "cli" });
      return "done";
    });

    expect(outcome).toEqual({ ok: true, value: "done" });
    await expect(readLease(root)).rejects.toThrow();
  });

  it("releases the lease when the body throws", async () => {
    const root = await temporaryRoot();
    const lease = new WorkspaceLeaseManager(root, { hostKind: "cli" });

    await expect(
      withWorkspaceLease(lease, async () => {
        throw new Error("the run failed");
      }),
    ).rejects.toThrow("the run failed");

    // A failed run that keeps the workspace would make the next one wait
    // out the full staleness window for nothing.
    await expect(readLease(root)).rejects.toThrow();
  });

  it("reports a live foreign holder instead of running the body", async () => {
    const root = await temporaryRoot();
    const holder = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });
    await holder.acquireOrRenew();
    const contender = new WorkspaceLeaseManager(root, { hostKind: "cli" });
    let ran = false;

    const outcome = await withWorkspaceLease(contender, async () => {
      ran = true;
    });

    expect(ran).toBe(false);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.conflict.hostKind).toBe("vscode-extension");
    // The holder still holds it: a refused contender must not have
    // deleted the file it failed to take.
    expect(await readLease(root)).toMatchObject({ hostKind: "vscode-extension" });
  });

  it("does not release a lease that was reclaimed away mid-run", async () => {
    const root = await temporaryRoot();
    const first = new WorkspaceLeaseManager(root, { hostKind: "cli" });

    const outcome = await withWorkspaceLease(first, async () => {
      // Somebody else decided this holder was stale and took over.
      const second = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension", staleAfterMs: -1 });
      await second.acquireOrRenew();
      return "finished anyway";
    });

    expect(outcome).toMatchObject({ ok: true, value: "finished anyway" });
    // The new owner's lease survives this one's exit.
    expect(await readLease(root)).toMatchObject({ hostKind: "vscode-extension" });
  });

  it("reports that the workspace was reclaimed from a stopped holder", async () => {
    const root = await temporaryRoot();
    await new WorkspaceLeaseManager(root, { hostKind: "standalone-server" }).acquireOrRenew();
    const taker = new WorkspaceLeaseManager(root, { hostKind: "cli", staleAfterMs: -1 });

    const outcome = await withWorkspaceLease(taker, async () => "ran");

    expect(outcome).toMatchObject({ ok: true, reclaimedFrom: { hostKind: "standalone-server" } });
  });
});
