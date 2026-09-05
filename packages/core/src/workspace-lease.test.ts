import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WORKSPACE_LEASE_VERSION,
  WorkspaceLeaseManager,
  describeWorkspaceLeaseConflict,
  describeWorkspaceLeaseReclamation,
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
