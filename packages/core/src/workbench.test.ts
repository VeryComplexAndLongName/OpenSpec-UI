import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteChange, discoverOpenSpecWorkspace, labelForSchemaArtifact, readChangesNamed, unarchiveChange } from "./workbench.js";

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

// an-artifact-label-says-what-it-is 1.1.
describe("labelForSchemaArtifact", () => {
  it("reads a short id as an abbreviation, a known term as the term, and other words as words", () => {
    expect(
      ["adr", "asyncapi", "openapi-contract", "api_design", "event-storming", "use-cases", "tech-notes"].map(labelForSchemaArtifact),
    ).toEqual(["ADR", "AsyncAPI", "OpenAPI contract", "API design", "Event storming", "Use cases", "Tech notes"]);
  });
});

describe("discoverOpenSpecWorkspace", () => {
  // the-pipeline-reads-each-workspace-once 1.1: a caller that needs one list
  // reads only that list, and the other is empty.
  it("reads only the active changes, or only the archived ones, when asked", async () => {
    const root = await temporaryRoot();
    await Promise.all([
      mkdir(path.join(root, "openspec", "changes", "active-change"), { recursive: true }),
      mkdir(path.join(root, "openspec", "changes", "archive", "2026-09-01-old-change"), { recursive: true }),
    ]);

    const all = await discoverOpenSpecWorkspace(root);
    const active = await discoverOpenSpecWorkspace(root, { changes: "active" });
    const archived = await discoverOpenSpecWorkspace(root, { changes: "archived" });

    expect([all.changes.map((c) => c.name), all.archivedChanges.map((c) => c.name)]).toEqual([["active-change"], ["2026-09-01-old-change"]]);
    expect([active.changes.map((c) => c.name), active.archivedChanges]).toEqual([["active-change"], []]);
    expect([archived.changes, archived.archivedChanges.map((c) => c.name)]).toEqual([[], ["2026-09-01-old-change"]]);
    expect(active.archiveExists).toBe(true);
  });

  // the-pipeline-reads-each-workspace-once 1.7: only the named directories
  // are read, and a name found in both lists is the active change.
  it("reads only the changes it is given the names of, and prefers the active one", async () => {
    const root = await temporaryRoot();
    await Promise.all(["alpha", "beta", "archive/2026-09-01-old", "archive/beta", "archive/2026-09-02-other"].map((name) =>
      mkdir(path.join(root, "openspec", "changes", ...name.split("/")), { recursive: true })));

    const named = await discoverOpenSpecWorkspace(root, { names: ["beta", "2026-09-01-old", "missing"] });
    expect([named.changes.map((c) => c.name), named.archivedChanges.map((c) => c.name)]).toEqual([["beta"], ["2026-09-01-old", "beta"]]);

    const found = await readChangesNamed(root, ["beta", "2026-09-01-old", "missing"]);
    expect([...found.keys()].sort()).toEqual(["2026-09-01-old", "beta"]);
    expect(found.get("beta")?.archived).toBe(false);
    expect(found.get("2026-09-01-old")?.archived).toBe(true);
    expect(await readChangesNamed(root, [])).toEqual(new Map());
  });

  it("reports an uninitialized workspace and missing collections", async () => {
    const root = await temporaryRoot();

    const workspace = await discoverOpenSpecWorkspace(root);

    expect(workspace.initialized).toBe(false);
    expect(workspace.configExists).toBe(false);
    expect(workspace.archiveExists).toBe(false);
    expect(workspace.specsRootExists).toBe(false);
    expect(workspace.changes).toEqual([]);
    expect(workspace.archivedChanges).toEqual([]);
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
    // Canonical specs are listed by the OpenSpec CLI, not by discovery
    // (a-change-lists-what-its-schema-declares 2.7).
    expect(workspace).not.toHaveProperty("specs");
  });

  // Both defects reported by DW, a user of the VS Code extension, on
  // 2026-09-15: a nested delta spec read as "Spec: web — missing", and the
  // project schema's ADR never appeared.
  // The real spec-driven-with-adr from intent-driven-dev/openspec-schemas,
  // which DW's project uses: proposal, specs, design, adr, tasks
  // (a-schema-artifact-stays-inside-its-change 3.1).
  it("lists a change's artifacts from its project schema, naming a nested delta spec by its path", async () => {
    const { installSchemaFixture } = await import("./test-support/openspec-schema-fixtures.js");
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "dashboard-declare-company-derivation");
    await mkdir(path.join(change, "specs", "web", "dashboard-foundation"), { recursive: true });
    const name = await installSchemaFixture(root, "spec-driven-with-adr");
    await Promise.all([
      writeFile(path.join(root, "openspec", "config.yaml"), `schema: ${name}\n`),
      writeFile(path.join(change, "proposal.md"), "# Proposal\n"),
      writeFile(path.join(change, "adr.md"), "# ADR\n"),
      writeFile(path.join(change, "exploration.md"), "# Exploration\n"),
      writeFile(path.join(change, "tasks.md"), "- [ ] one\n"),
      writeFile(path.join(change, "specs", "web", "dashboard-foundation", "spec.md"), "## ADDED Requirements\n"),
    ]);

    const workspace = await discoverOpenSpecWorkspace(root, NO_USER_SCHEMAS);

    const artifacts = workspace.changes[0]?.artifacts ?? [];
    expect(artifacts.map((artifact) => [artifact.id, artifact.kind, artifact.label, artifact.exists])).toEqual([
      ["proposal", "proposal", "Proposal", true],
      ["delta-spec:web/dashboard-foundation", "delta-spec", "web/dashboard-foundation", true],
      ["design", "design", "Design", false],
      ["adr", "schema-artifact", "ADR", true],
      ["tasks", "tasks", "Tasks", true],
    ]);
    // Only what the schema declares: DW's exploration notes are not an artifact.
    expect(artifacts.some((artifact) => artifact.label === "web" || artifact.path.endsWith("exploration.md"))).toBe(false);
    expect(workspace.changes[0]?.schema).toMatchObject({ name: "spec-driven-with-adr", source: "project" });
    expect(workspace.changes[0]?.schema?.fallback).toBeUndefined();
  });

  it("lists event-driven's artifacts in its order, with AsyncAPI written as the term", async () => {
    const { installSchemaFixture } = await import("./test-support/openspec-schema-fixtures.js");
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "order-events");
    await mkdir(path.join(change, "specs", "orders"), { recursive: true });
    const name = await installSchemaFixture(root, "event-driven");
    await Promise.all([
      writeFile(path.join(change, ".openspec.yaml"), `schema: ${name}\n`),
      writeFile(path.join(change, "event-storming.md"), "# Event storming\n"),
      writeFile(path.join(change, "asyncapi.yaml"), "asyncapi: 3.0.0\n"),
      writeFile(path.join(change, "specs", "orders", "spec.md"), "## ADDED Requirements\n"),
    ]);

    const workspace = await discoverOpenSpecWorkspace(root, NO_USER_SCHEMAS);

    // an-artifact-label-says-what-it-is 1.4: `asyncapi` read "Asyncapi" before.
    expect(workspace.changes[0]?.artifacts.map((artifact) => [artifact.id, artifact.label, artifact.exists])).toEqual([
      ["event-storming", "Event storming", true],
      ["event-modeling", "Event modeling", false],
      ["delta-spec:orders", "orders", true],
      ["design", "Design", false],
      ["asyncapi", "AsyncAPI", true],
      ["tasks", "Tasks", false],
    ]);
  });

  // an-artifact-label-says-what-it-is 1.4. OpenSpec CLI 1.7.0's archive merged
  // only specs/checkout/spec.md from such a change, and validate passed it.
  it("names minimalist's spec files outside a capability folder by artifact and file, marked not applied on archive", async () => {
    const { installSchemaFixture } = await import("./test-support/openspec-schema-fixtures.js");
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "landing");
    await mkdir(path.join(change, "specs", "checkout"), { recursive: true });
    const name = await installSchemaFixture(root, "minimalist");
    await Promise.all([
      writeFile(path.join(change, ".openspec.yaml"), `schema: ${name}\n`),
      writeFile(path.join(change, "specs", "checkout", "spec.md"), "## ADDED Requirements\n"),
      writeFile(path.join(change, "specs", "checkout", "notes.md"), "Why checkout first.\n"),
      writeFile(path.join(change, "specs", "landing-page.md"), "As a visitor, I want a landing page.\n"),
      writeFile(path.join(change, "specs", "spec.md"), "## ADDED Requirements\n"),
      writeFile(path.join(change, "tasks.md"), "- [ ] one\n"),
    ]);

    const workspace = await discoverOpenSpecWorkspace(root, NO_USER_SCHEMAS);

    expect(
      workspace.changes[0]?.artifacts.map((artifact) => [artifact.id, artifact.kind, artifact.label, artifact.notAppliedOnArchive]),
    ).toEqual([
      ["specs:specs/checkout/notes.md", "schema-artifact", "Specs: checkout/notes.md", true],
      ["delta-spec:checkout", "delta-spec", "checkout", undefined],
      ["specs:specs/landing-page.md", "schema-artifact", "Specs: landing-page.md", true],
      ["specs:specs/spec.md", "schema-artifact", "Specs: spec.md", true],
      ["tasks", "tasks", "Tasks", undefined],
    ]);
  });

  // a-schema-artifact-stays-inside-its-change 2.3: the spec-driven-with-adr
  // version in use from 2026-05-11 to 2026-06-22 declared `adr` as
  // `../../../adr/*.md`.
  it("lists no file outside the change, for a schema whose glob reaches the repository's adr/", async () => {
    const { installSchemaFixture } = await import("./test-support/openspec-schema-fixtures.js");
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "old-adr-schema");
    await Promise.all([
      mkdir(change, { recursive: true }),
      mkdir(path.join(root, "adr"), { recursive: true }),
    ]);
    const name = await installSchemaFixture(root, "spec-driven-with-adr-f04aaa2");
    await Promise.all([
      writeFile(path.join(root, "openspec", "config.yaml"), `schema: ${name}\n`),
      writeFile(path.join(root, "adr", "0001-first-decision.md"), "# 0001\n"),
      writeFile(path.join(root, "adr", "0002-second-decision.md"), "# 0002\n"),
      writeFile(path.join(change, "proposal.md"), "# Proposal\n"),
    ]);

    const workspace = await discoverOpenSpecWorkspace(root, NO_USER_SCHEMAS);

    const artifacts = workspace.changes[0]?.artifacts ?? [];
    expect(artifacts.map((artifact) => artifact.id)).toEqual(["proposal", "design", "tasks"]);
    expect(artifacts.every((artifact) => !path.relative(change, artifact.path).startsWith(".."))).toBe(true);
  });

  it("lists nothing reached through a link inside the change that points outside it", async () => {
    const { symlink } = await import("node:fs/promises");
    const root = await temporaryRoot();
    const outside = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "linked");
    await Promise.all([
      mkdir(path.join(change, "specs"), { recursive: true }),
      mkdir(path.join(outside, "elsewhere"), { recursive: true }),
    ]);
    await writeFile(path.join(outside, "elsewhere", "spec.md"), "## ADDED Requirements\n");
    await symlink(outside, path.join(change, "specs", "borrowed"), process.platform === "win32" ? "junction" : "dir");

    const workspace = await discoverOpenSpecWorkspace(root, NO_USER_SCHEMAS);

    expect(workspace.changes[0]?.artifacts.map((artifact) => artifact.id)).toEqual(["proposal", "design", "tasks"]);
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
