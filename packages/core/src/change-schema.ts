// Which artifacts a change has, according to its OpenSpec schema (ADR 0031;
// a-change-lists-what-its-schema-declares). Both defects this answers were
// found and reported by DW, a user of the VS Code extension: a delta spec
// nested as `specs/<area>/<capability>/spec.md` read as missing, and a custom
// schema's `adr.md` never appeared.
//
// The schema is resolved the way OpenSpec CLI 1.7.0 resolves it, and read
// from disk. The CLI is never started here: discovery is polled.
//   name:  the change's `.openspec.yaml`, then `openspec/config.yaml`, then
//          `spec-driven`;
//   file:  `<project>/openspec/schemas/<name>/schema.yaml`, then the user's
//          `<data>/openspec/schemas/<name>/schema.yaml`, then the built-in
//          `spec-driven`, carried below as data.

import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface SchemaArtifact {
  id: string;
  generates: string;
}

export type ChangeSchemaSource = "project" | "user" | "built-in";

export type ChangeSchemaFallbackReason = "not-found" | "unreadable" | "no-artifacts";

export interface ChangeSchema {
  /** The schema the change names, or `spec-driven` when it names none. */
  name: string;
  /** Where the artifacts below were read from. */
  source: ChangeSchemaSource;
  artifacts: readonly SchemaArtifact[];
  /** Set when the named schema could not be read, and the built-in
   * `spec-driven` artifacts are listed instead. */
  fallback?: { reason: ChangeSchemaFallbackReason; detail: string };
}

export const DEFAULT_SCHEMA_NAME = "spec-driven";

/** The schemas OpenSpec CLI 1.7.0 ships in its package, as it declares them
 * in `schemas/<name>/schema.yaml`. */
export const BUILT_IN_SCHEMAS: Readonly<Record<string, readonly SchemaArtifact[]>> = {
  "spec-driven": [
    { id: "proposal", generates: "proposal.md" },
    { id: "specs", generates: "specs/**/*.md" },
    { id: "design", generates: "design.md" },
    { id: "tasks", generates: "tasks.md" },
  ],
};

export interface SchemaEnvironment {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homedir?: string;
}

/** The user's OpenSpec schema directory, as the CLI's `getGlobalDataDir`
 * computes it: `$XDG_DATA_HOME` on any platform, then `%LOCALAPPDATA%` on
 * Windows, then `~/AppData/Local` there or `~/.local/share` elsewhere. */
export function userSchemasDir(environment: SchemaEnvironment = {}): string {
  const env = environment.env ?? process.env;
  const platform = environment.platform ?? process.platform;
  const join = platform === "win32" ? path.win32.join : path.posix.join;
  const home = environment.homedir ?? os.homedir();
  if (env.XDG_DATA_HOME) return join(env.XDG_DATA_HOME, "openspec", "schemas");
  if (platform === "win32") {
    return env.LOCALAPPDATA
      ? join(env.LOCALAPPDATA, "openspec", "schemas")
      : join(home, "AppData", "Local", "openspec", "schemas");
  }
  return join(home, ".local", "share", "openspec", "schemas");
}

async function readText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

/** The `schema` field of a YAML file, or undefined when the file is absent,
 * does not parse, or names none. */
async function schemaFieldOf(filePath: string): Promise<string | undefined> {
  const text = await readText(filePath);
  if (text === undefined) return undefined;
  try {
    const parsed: unknown = parseYaml(text);
    if (parsed && typeof parsed === "object" && "schema" in parsed) {
      const value = (parsed as { schema: unknown }).schema;
      if (typeof value === "string" && value.trim().length > 0) return value.trim().replace(/\.ya?ml$/u, "");
    }
  } catch {
    // A metadata file that does not parse names no schema; the next source decides.
  }
  return undefined;
}

/** The schema name a change uses. */
export async function schemaNameForChange(changeDir: string, projectRoot: string): Promise<string> {
  return (await schemaFieldOf(path.join(changeDir, ".openspec.yaml")))
    ?? (await schemaFieldOf(path.join(projectRoot, "openspec", "config.yaml")))
    ?? DEFAULT_SCHEMA_NAME;
}

type ParsedSchema = { artifacts: SchemaArtifact[] } | { problem: ChangeSchemaFallbackReason; detail: string };

/** Reads a schema file's artifacts, refusing what the CLI refuses: an
 * artifact without `id` or `generates`, or an id declared twice. */
export function parseSchemaArtifacts(text: string, filePath: string): ParsedSchema {
  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (error) {
    return { problem: "unreadable", detail: `${filePath} does not parse: ${error instanceof Error ? error.message : String(error)}` };
  }
  const list = parsed && typeof parsed === "object" ? (parsed as { artifacts?: unknown }).artifacts : undefined;
  if (!Array.isArray(list) || list.length === 0) {
    return { problem: "no-artifacts", detail: `${filePath} declares no artifacts` };
  }
  const artifacts: SchemaArtifact[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of list.entries()) {
    const id = entry && typeof entry === "object" ? (entry as { id?: unknown }).id : undefined;
    const generates = entry && typeof entry === "object" ? (entry as { generates?: unknown }).generates : undefined;
    if (typeof id !== "string" || id.length === 0 || typeof generates !== "string" || generates.length === 0) {
      return { problem: "unreadable", detail: `${filePath}: artifact ${index + 1} needs both an id and generates` };
    }
    if (seen.has(id)) return { problem: "unreadable", detail: `${filePath}: artifact id "${id}" is declared twice` };
    seen.add(id);
    artifacts.push({ id, generates });
  }
  return { artifacts };
}

/** Parsed schema files by path, shared across the changes of one discovery,
 * so a workspace with many changes under one schema reads it once. */
export type SchemaCache = Map<string, Promise<ParsedSchema | undefined>>;

async function readSchemaFile(filePath: string, cache: SchemaCache): Promise<ParsedSchema | undefined> {
  let pending = cache.get(filePath);
  if (!pending) {
    pending = readText(filePath).then((text) => (text === undefined ? undefined : parseSchemaArtifacts(text, filePath)));
    cache.set(filePath, pending);
  }
  return pending;
}

function fallBack(name: string, reason: ChangeSchemaFallbackReason, detail: string): ChangeSchema {
  return { name, source: "built-in", artifacts: BUILT_IN_SCHEMAS[DEFAULT_SCHEMA_NAME]!, fallback: { reason, detail } };
}

/** The schema a change uses, with its artifacts. Never throws: a schema that
 * cannot be read falls back to `spec-driven`, and says why. */
export async function resolveChangeSchema(
  changeDir: string,
  projectRoot: string,
  cache: SchemaCache = new Map(),
  environment: SchemaEnvironment = {},
): Promise<ChangeSchema> {
  const name = await schemaNameForChange(changeDir, projectRoot);
  const candidates: Array<{ source: ChangeSchemaSource; file: string }> = [
    { source: "project", file: path.join(projectRoot, "openspec", "schemas", name, "schema.yaml") },
    { source: "user", file: path.join(userSchemasDir(environment), name, "schema.yaml") },
  ];
  for (const candidate of candidates) {
    const parsed = await readSchemaFile(candidate.file, cache);
    if (parsed === undefined) continue;
    if ("problem" in parsed) return fallBack(name, parsed.problem, parsed.detail);
    return { name, source: candidate.source, artifacts: parsed.artifacts };
  }
  const builtIn = BUILT_IN_SCHEMAS[name];
  if (builtIn) return { name, source: "built-in", artifacts: builtIn };
  return fallBack(
    name,
    "not-found",
    `schema "${name}" is not in openspec/schemas, the user schema directory, or the built-in schemas`,
  );
}

const GLOB_CHARACTERS = /[*?]/u;

export function isGlobPattern(generates: string): boolean {
  return GLOB_CHARACTERS.test(generates);
}

function segmentPattern(segment: string): RegExp {
  let source = "";
  for (const character of segment) {
    if (character === "*") source += "[^/]*";
    else if (character === "?") source += "[^/]";
    else source += character.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
  }
  return new RegExp(`^${source}$`, "u");
}

/** Whether a relative POSIX path matches a glob of `*`, `?` and `**` segments. */
export function matchesGlob(relativePath: string, pattern: string): boolean {
  const parts = relativePath.split("/");
  const segments = pattern.split("/");
  const match = (pathIndex: number, segmentIndex: number): boolean => {
    if (segmentIndex === segments.length) return pathIndex === parts.length;
    const segment = segments[segmentIndex]!;
    if (segment === "**") {
      for (let next = pathIndex; next <= parts.length; next += 1) {
        if (match(next, segmentIndex + 1)) return true;
      }
      return false;
    }
    if (pathIndex === parts.length) return false;
    return segmentPattern(segment).test(parts[pathIndex]!) && match(pathIndex + 1, segmentIndex + 1);
  };
  return match(0, 0);
}

async function walkFiles(root: string, relative: string, found: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(path.join(root, relative), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    // fast-glob's default, which the CLI uses: a dot name is not matched.
    if (entry.name.startsWith(".")) continue;
    const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
    let isDirectory = entry.isDirectory();
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      try {
        const target = await stat(path.join(root, child));
        isDirectory = target.isDirectory();
        isFile = target.isFile();
      } catch {
        continue;
      }
    }
    if (isDirectory) await walkFiles(root, child, found);
    else if (isFile) found.push(child);
  }
}

/** The files an artifact's `generates` value names under `changeDir`, as
 * relative POSIX paths. A plain path is returned whether or not it exists;
 * a glob returns the files it matches, sorted. */
export async function resolveGenerates(changeDir: string, generates: string): Promise<string[]> {
  const pattern = generates.replace(/\\/gu, "/").replace(/^\.\//u, "");
  if (!isGlobPattern(pattern)) return [pattern];
  const segments = pattern.split("/");
  const literal: string[] = [];
  for (const segment of segments) {
    if (isGlobPattern(segment)) break;
    literal.push(segment);
  }
  const files: string[] = [];
  await walkFiles(changeDir, literal.join("/"), files);
  return files.filter((file) => matchesGlob(file, pattern)).sort((left, right) => left.localeCompare(right));
}
