import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUILT_IN_SCHEMAS,
  matchesGlob,
  parseSchemaArtifacts,
  resolveChangeSchema,
  resolveGenerates,
  schemaNameForChange,
  userSchemasDir,
} from "./change-schema.js";

// Reads a handful of files per test in a temporary directory. Measured
// 2026-09-15 at under 0.1s per test idle; the budget follows
// workbench.test.ts, whose same-sized disk work swung 27x under co-load.
vi.setConfig({ testTimeout: 60_000 });

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-schema-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function put(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

const ADR_SCHEMA = [
  "name: spec-driven-with-adr",
  "version: 1",
  "artifacts:",
  "  - id: proposal",
  "    generates: proposal.md",
  "    template: proposal.md",
  "  - id: adr",
  "    generates: adr.md",
  "    template: adr.md",
  "  - id: specs",
  "    generates: \"specs/**/*.md\"",
  "    template: spec.md",
  "  - id: design",
  "    generates: design.md",
  "    template: design.md",
  "  - id: tasks",
  "    generates: tasks.md",
  "    template: tasks.md",
  "",
].join("\n");

/** A user directory nobody's real schemas live in. */
const NO_USER_SCHEMAS = { env: { XDG_DATA_HOME: path.join(os.tmpdir(), "openspec-schema-no-user") } };

describe("schemaNameForChange", () => {
  it("reads the change's .openspec.yaml first, then config.yaml, then defaults to spec-driven", async () => {
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "one");
    await mkdir(change, { recursive: true });
    expect(await schemaNameForChange(change, root)).toBe("spec-driven");

    await put(path.join(root, "openspec", "config.yaml"), "schema: from-config\n");
    expect(await schemaNameForChange(change, root)).toBe("from-config");

    await put(path.join(change, ".openspec.yaml"), "schema: from-change\ncreated: 2026-09-15\n");
    expect(await schemaNameForChange(change, root)).toBe("from-change");
  });

  it("treats a metadata file that does not parse as naming no schema", async () => {
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "one");
    await put(path.join(change, ".openspec.yaml"), "schema: [unclosed\n");
    await put(path.join(root, "openspec", "config.yaml"), "schema: from-config\n");
    expect(await schemaNameForChange(change, root)).toBe("from-config");
  });
});

describe("userSchemasDir", () => {
  it("follows the CLI: XDG_DATA_HOME, then LOCALAPPDATA on Windows, then the home fallbacks", () => {
    expect(userSchemasDir({ env: { XDG_DATA_HOME: "/data" }, platform: "linux", homedir: "/home/u" }))
      .toBe("/data/openspec/schemas");
    expect(userSchemasDir({ env: { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" }, platform: "win32", homedir: "C:\\Users\\u" }))
      .toBe("C:\\Users\\u\\AppData\\Local\\openspec\\schemas");
    expect(userSchemasDir({ env: {}, platform: "win32", homedir: "C:\\Users\\u" }))
      .toBe("C:\\Users\\u\\AppData\\Local\\openspec\\schemas");
    expect(userSchemasDir({ env: {}, platform: "darwin", homedir: "/Users/u" }))
      .toBe("/Users/u/.local/share/openspec/schemas");
  });
});

describe("resolveChangeSchema", () => {
  it("reads a project schema, in the order it declares its artifacts", async () => {
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "dashboard");
    await put(path.join(change, ".openspec.yaml"), "schema: spec-driven-with-adr\n");
    await put(path.join(root, "openspec", "schemas", "spec-driven-with-adr", "schema.yaml"), ADR_SCHEMA);

    const schema = await resolveChangeSchema(change, root, new Map(), NO_USER_SCHEMAS);

    expect(schema.source).toBe("project");
    expect(schema.fallback).toBeUndefined();
    expect(schema.artifacts.map((artifact) => artifact.id)).toEqual(["proposal", "adr", "specs", "design", "tasks"]);
  });

  it("reads a user schema, and lets a project schema of the same name shadow it", async () => {
    const root = await temporaryRoot();
    const userData = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "one");
    await put(path.join(change, ".openspec.yaml"), "schema: shared\n");
    await put(path.join(userData, "openspec", "schemas", "shared", "schema.yaml"), [
      "artifacts:",
      "  - id: notes",
      "    generates: notes.md",
      "",
    ].join("\n"));
    const environment = { env: { XDG_DATA_HOME: userData } };

    const fromUser = await resolveChangeSchema(change, root, new Map(), environment);
    expect(fromUser.source).toBe("user");
    expect(fromUser.artifacts.map((artifact) => artifact.id)).toEqual(["notes"]);

    await put(path.join(root, "openspec", "schemas", "shared", "schema.yaml"), ADR_SCHEMA);
    const fromProject = await resolveChangeSchema(change, root, new Map(), environment);
    expect(fromProject.source).toBe("project");
  });

  it("uses the built-in spec-driven schema when the change names none", async () => {
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "one");
    await mkdir(change, { recursive: true });

    const schema = await resolveChangeSchema(change, root, new Map(), NO_USER_SCHEMAS);

    expect(schema).toEqual({ name: "spec-driven", source: "built-in", artifacts: BUILT_IN_SCHEMAS["spec-driven"] });
  });

  it("falls back to spec-driven, naming the schema, when the schema is found nowhere", async () => {
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "one");
    await put(path.join(change, ".openspec.yaml"), "schema: nowhere\n");

    const schema = await resolveChangeSchema(change, root, new Map(), NO_USER_SCHEMAS);

    expect(schema.name).toBe("nowhere");
    expect(schema.artifacts).toEqual(BUILT_IN_SCHEMAS["spec-driven"]);
    expect(schema.fallback?.reason).toBe("not-found");
    expect(schema.fallback?.detail).toContain("nowhere");
  });

  it("falls back when the schema file does not parse, or declares no artifacts", async () => {
    const root = await temporaryRoot();
    const change = path.join(root, "openspec", "changes", "one");
    await put(path.join(change, ".openspec.yaml"), "schema: broken\n");
    await put(path.join(root, "openspec", "schemas", "broken", "schema.yaml"), "artifacts: [\n");
    expect((await resolveChangeSchema(change, root, new Map(), NO_USER_SCHEMAS)).fallback?.reason).toBe("unreadable");

    await put(path.join(root, "openspec", "schemas", "broken", "schema.yaml"), "name: broken\nartifacts: []\n");
    expect((await resolveChangeSchema(change, root, new Map(), NO_USER_SCHEMAS)).fallback?.reason).toBe("no-artifacts");
  });

  it("reads one schema file once across the changes of a discovery", async () => {
    const root = await temporaryRoot();
    const cache = new Map();
    await put(path.join(root, "openspec", "config.yaml"), "schema: spec-driven-with-adr\n");
    await put(path.join(root, "openspec", "schemas", "spec-driven-with-adr", "schema.yaml"), ADR_SCHEMA);

    await resolveChangeSchema(path.join(root, "openspec", "changes", "a"), root, cache, NO_USER_SCHEMAS);
    await resolveChangeSchema(path.join(root, "openspec", "changes", "b"), root, cache, NO_USER_SCHEMAS);

    const projectFile = path.join(root, "openspec", "schemas", "spec-driven-with-adr", "schema.yaml");
    expect([...cache.keys()].filter((key) => key === projectFile)).toHaveLength(1);
  });
});

describe("parseSchemaArtifacts", () => {
  it("refuses what the CLI refuses: a missing id or generates, and a repeated id", () => {
    expect(parseSchemaArtifacts("artifacts:\n  - id: a\n", "s.yaml")).toMatchObject({ problem: "unreadable" });
    expect(parseSchemaArtifacts("artifacts:\n  - generates: a.md\n", "s.yaml")).toMatchObject({ problem: "unreadable" });
    expect(
      parseSchemaArtifacts("artifacts:\n  - id: a\n    generates: a.md\n  - id: a\n    generates: b.md\n", "s.yaml"),
    ).toMatchObject({ problem: "unreadable" });
  });
});

describe("resolveGenerates", () => {
  it("returns a plain path whether or not it exists", async () => {
    const root = await temporaryRoot();
    expect(await resolveGenerates(root, "design.md")).toEqual(["design.md"]);
  });

  it("matches DW's nested delta spec as the CLI does, at any depth, files only, no dot names", async () => {
    // The CLI's own answer for this layout, captured on 2026-09-15 from
    // `openspec status --change dashboard-change --json` (OpenSpec 1.7.0):
    // existingOutputPaths for `specs/**/*.md` held exactly
    // specs/web/dashboard-foundation/spec.md.
    const root = await temporaryRoot();
    await put(path.join(root, "specs", "web", "dashboard-foundation", "spec.md"), "## ADDED Requirements\n");
    await put(path.join(root, "specs", "flat", "spec.md"), "## ADDED Requirements\n");
    await put(path.join(root, "specs", ".hidden", "spec.md"), "hidden\n");
    await put(path.join(root, "specs", "web", "notes.txt"), "not markdown\n");
    await mkdir(path.join(root, "specs", "empty.md"), { recursive: true });

    expect(await resolveGenerates(root, "specs/**/*.md")).toEqual([
      "specs/flat/spec.md",
      "specs/web/dashboard-foundation/spec.md",
    ]);
  });

  it("matches nothing when the directory a glob walks is absent", async () => {
    const root = await temporaryRoot();
    expect(await resolveGenerates(root, "specs/**/*.md")).toEqual([]);
  });
});

describe("matchesGlob", () => {
  it("supports *, ? and ** segments", () => {
    expect(matchesGlob("specs/a/spec.md", "specs/**/*.md")).toBe(true);
    expect(matchesGlob("specs/spec.md", "specs/**/*.md")).toBe(true);
    expect(matchesGlob("specs/a/b/c/spec.md", "specs/**/spec.md")).toBe(true);
    expect(matchesGlob("notes/a.md", "specs/**/*.md")).toBe(false);
    expect(matchesGlob("adr-1.md", "adr-?.md")).toBe(true);
    expect(matchesGlob("adr-12.md", "adr-?.md")).toBe(false);
  });
});
