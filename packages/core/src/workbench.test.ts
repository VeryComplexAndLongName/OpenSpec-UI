import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteChange, discoverOpenSpecWorkspace, unarchiveChange } from "./workbench.js";

// every-varying-check-has-a-budget:
// measured 2026-09-05 at 0.2s idle and 0.6s under deliberate 8-worker CPU
// co-load — and then 16.2s for the same test on an identical repeat of
// that co-loaded run, a 27x swing between two runs of the same thing. The
// budget is sized from the worst figure, not the first one. See task 4.2
// of every-varying-check-has-a-budget: on this machine a file's loaded
// cost is not stable enough for a single measurement to size a ceiling.
vi.setConfig({ testTimeout: 60_000 });

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-workbench-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("discoverOpenSpecWorkspace", () => {
  it("reports an uninitialized workspace and missing collections", async () => {
    const root = await temporaryRoot();

    const workspace = await discoverOpenSpecWorkspace(root);

    expect(workspace.initialized).toBe(false);
    expect(workspace.configExists).toBe(false);
    expect(workspace.archiveExists).toBe(false);
    expect(workspace.specsRootExists).toBe(false);
    expect(workspace.changes).toEqual([]);
    expect(workspace.archivedChanges).toEqual([]);
    expect(workspace.specs).toEqual([]);
  });

  it("discovers config, change artifacts, archive, and canonical specs", async () => {
    const root = await temporaryRoot();
    const active = path.join(root, "openspec", "changes", "active-change");
    const archived = path.join(root, "openspec", "changes", "archive", "old-change");
    const deltaSpec = path.join(active, "specs", "demo");
    const canonicalSpec = path.join(root, "openspec", "specs", "demo");
    await Promise.all([
      mkdir(deltaSpec, { recursive: true }),
      mkdir(archived, { recursive: true }),
      mkdir(canonicalSpec, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n"),
      writeFile(path.join(active, "proposal.md"), "# Proposal\n"),
      writeFile(path.join(active, "tasks.md"), "- [x] done\n"),
      writeFile(path.join(deltaSpec, "spec.md"), "# Delta\n"),
      writeFile(path.join(archived, "tasks.md"), "- [x] done\n"),
      writeFile(path.join(canonicalSpec, "spec.md"), "# Spec\n"),
    ]);

    const workspace = await discoverOpenSpecWorkspace(root);

    expect(workspace.initialized).toBe(true);
    expect(workspace.configExists).toBe(true);
    expect(workspace.archiveExists).toBe(true);
    expect(workspace.specsRootExists).toBe(true);
    expect(workspace.changes).toHaveLength(1);
    expect(workspace.changes[0]?.state).toBe("implemented");
    expect(workspace.changes[0]?.artifacts.map((artifact) => [artifact.id, artifact.exists])).toEqual([
      ["proposal", true],
      ["design", false],
      ["tasks", true],
      ["delta-spec:demo", true],
    ]);
    expect(workspace.archivedChanges[0]?.state).toBe("archived");
    expect(workspace.specs).toEqual([
      { id: "demo", path: path.join(canonicalSpec, "spec.md"), exists: true },
    ]);
  });
});

describe("change lifecycle filesystem operations", () => {
  it("unarchives a change without overwriting an active change", async () => {
    const root = await temporaryRoot();
    const archived = path.join(root, "openspec", "changes", "archive", "old-change");
    await mkdir(archived, { recursive: true });
    await writeFile(path.join(archived, "proposal.md"), "# Old\n");

    await unarchiveChange(root, "old-change");

    const workspace = await discoverOpenSpecWorkspace(root);
    expect(workspace.changes.map((change) => change.name)).toEqual(["old-change"]);
    expect(workspace.archivedChanges).toEqual([]);
    await expect(unarchiveChange(root, "old-change")).rejects.toThrow("does not exist");
  });

  it("deletes only the selected active or archived change", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec", "changes", "keep"), { recursive: true });
    await mkdir(path.join(root, "openspec", "changes", "remove"), { recursive: true });

    await deleteChange(root, "remove", "active");

    const workspace = await discoverOpenSpecWorkspace(root);
    expect(workspace.changes.map((change) => change.name)).toEqual(["keep"]);
  });

  it("rejects traversal and destination collisions", async () => {
    const root = await temporaryRoot();
    const active = path.join(root, "openspec", "changes", "same-change");
    const archived = path.join(root, "openspec", "changes", "archive", "same-change");
    await Promise.all([mkdir(active, { recursive: true }), mkdir(archived, { recursive: true })]);

    await expect(deleteChange(root, "../outside", "active")).rejects.toThrow("Invalid OpenSpec change name");
    await expect(unarchiveChange(root, "same-change")).rejects.toThrow("already exists");
  });
});
