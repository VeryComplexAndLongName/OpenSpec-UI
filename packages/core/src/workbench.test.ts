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
    // In the order the built-in spec-driven schema declares its artifacts:
    // proposal, specs, design, tasks (ADR 0031).
    expect(workspace.changes[0]?.artifacts.map((artifact) => [artifact.id, artifact.exists])).toEqual([
      ["proposal", true],
      ["delta-spec:demo", true],
      ["design", false],
      ["tasks", true],
    ]);
    expect(workspace.changes[0]?.schema).toMatchObject({ name: "spec-driven", source: "built-in" });
    expect(workspace.archivedChanges[0]?.state).toBe("archived");
    expect(workspace.specs).toEqual([
      { id: "demo", path: path.join(canonicalSpec, "spec.md"), exists: true },
    ]);
  });

  // Both defects reported by DW, a user of the VS Code extension, on
  // 2026-09-15: a nested delta spec read as "Spec: web — missing", and the
  // project schema's ADR never appeared.
  it("lists a change's artifacts from its project schema, naming a nested delta spec by its path", async () => {
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "dashboard-declare-company-derivation");
    const schemaDir = path.join(root, "openspec", "schemas", "spec-driven-with-adr");
    await Promise.all([
      mkdir(path.join(change, "specs", "web", "dashboard-foundation"), { recursive: true }),
      mkdir(schemaDir, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven-with-adr\n"),
      writeFile(path.join(schemaDir, "schema.yaml"), [
        "name: spec-driven-with-adr",
        "artifacts:",
        "  - { id: proposal, generates: proposal.md, template: proposal.md }",
        "  - { id: adr, generates: adr.md, template: adr.md }",
        "  - { id: specs, generates: \"specs/**/*.md\", template: spec.md }",
        "  - { id: design, generates: design.md, template: design.md }",
        "  - { id: tasks, generates: tasks.md, template: tasks.md }",
        "",
      ].join("\n")),
      writeFile(path.join(change, "proposal.md"), "# Proposal\n"),
      writeFile(path.join(change, "adr.md"), "# ADR\n"),
      writeFile(path.join(change, "tasks.md"), "- [ ] one\n"),
      writeFile(path.join(change, "specs", "web", "dashboard-foundation", "spec.md"), "## ADDED Requirements\n"),
    ]);

    const workspace = await discoverOpenSpecWorkspace(root, NO_USER_SCHEMAS);

    const artifacts = workspace.changes[0]?.artifacts ?? [];
    expect(artifacts.map((artifact) => [artifact.id, artifact.kind, artifact.label, artifact.exists])).toEqual([
      ["proposal", "proposal", "Proposal", true],
      ["adr", "schema-artifact", "ADR", true],
      ["delta-spec:web/dashboard-foundation", "delta-spec", "web/dashboard-foundation", true],
      ["design", "design", "Design", false],
      ["tasks", "tasks", "Tasks", true],
    ]);
    expect(artifacts.some((artifact) => artifact.label === "web")).toBe(false);
    expect(workspace.changes[0]?.schema).toMatchObject({ name: "spec-driven-with-adr", source: "project" });
    expect(workspace.changes[0]?.schema?.fallback).toBeUndefined();
  });

  it("lists the spec-driven artifacts, and says why, when the change's schema is found nowhere", async () => {
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "lost-schema");
    await mkdir(change, { recursive: true });
    await Promise.all([
      writeFile(path.join(change, ".openspec.yaml"), "schema: nowhere-to-be-found\n"),
      writeFile(path.join(change, "proposal.md"), "# Proposal\n"),
    ]);

    const workspace = await discoverOpenSpecWorkspace(root, NO_USER_SCHEMAS);

    expect(workspace.changes[0]?.artifacts.map((artifact) => artifact.id)).toEqual(["proposal", "design", "tasks"]);
    expect(workspace.changes[0]?.schema?.fallback?.reason).toBe("not-found");
    expect(workspace.changes[0]?.schema?.name).toBe("nowhere-to-be-found");
  });
});

/** A user schema directory no real schema lives in, so a test never reads
 * the machine's own `~/.local/share/openspec/schemas`. */
const NO_USER_SCHEMAS = {
  schemaEnvironment: { env: { XDG_DATA_HOME: path.join(os.tmpdir(), "openspec-workbench-no-user-schemas") } },
};

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
