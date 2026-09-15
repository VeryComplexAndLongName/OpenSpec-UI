import { access, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { readChangeState, type ChangeState } from "./change-state.js";
import {
  assertValidChangeName,
  CHANGE_NAME_PATTERN,
  InvalidChangeNameError,
  isValidChangeName,
} from "./change-name.js";
import {
  resolveChangeSchema,
  resolveGenerates,
  type ChangeSchema,
  type SchemaCache,
  type SchemaEnvironment,
} from "./change-schema.js";

/** `proposal`, `design` and `tasks` keep their own kinds, and delta specs
 * theirs, because the Timeline, the task checklist, the task templates and
 * the spec-delta check find them by it. Anything else a change's schema
 * declares is a `schema-artifact` (ADR 0031). */
export type ChangeArtifactKind = "proposal" | "design" | "tasks" | "delta-spec" | "schema-artifact";

export interface WorkbenchArtifact {
  id: string;
  kind: ChangeArtifactKind;
  label: string;
  path: string;
  exists: boolean;
}

export interface WorkbenchChange {
  name: string;
  path: string;
  state: ChangeState;
  archived: boolean;
  artifacts: WorkbenchArtifact[];
  /** The OpenSpec schema the artifacts were read from, and why it fell
   * back to `spec-driven` where it did. Absent in hand-built values. */
  schema?: ChangeSchema;
}

export interface WorkbenchSpec {
  id: string;
  path: string;
  exists: boolean;
}

export interface OpenSpecWorkspace {
  root: string;
  openspecRoot: string;
  initialized: boolean;
  configPath: string;
  configExists: boolean;
  changes: WorkbenchChange[];
  archivedChanges: WorkbenchChange[];
  specs: WorkbenchSpec[];
  archiveExists: boolean;
  specsRootExists: boolean;
}

export type ChangeLocation = "active" | "archive";

// The rule itself lives in `change-name.ts`, a module with no Node
// imports, so the pure half of core (`scheduled-runs.ts`, and the
// browser bundle built from it) applies the same one. Re-exported here
// because this is where callers have always found it.
export { assertValidChangeName, CHANGE_NAME_PATTERN, InvalidChangeNameError, isValidChangeName };

function changePath(root: string, changeName: string, location: ChangeLocation): string {
  assertValidChangeName(changeName);
  const changesRoot = path.join(path.resolve(root), "openspec", "changes");
  return location === "archive"
    ? path.join(changesRoot, "archive", changeName)
    : path.join(changesRoot, changeName);
}

export async function unarchiveChange(root: string, changeName: string): Promise<void> {
  const source = changePath(root, changeName, "archive");
  const destination = changePath(root, changeName, "active");
  if (!(await exists(source))) throw new Error(`Archived change does not exist: ${changeName}`);
  if (await exists(destination)) throw new Error(`Active change already exists: ${changeName}`);
  await rename(source, destination);
}

export async function deleteChange(
  root: string,
  changeName: string,
  location: ChangeLocation,
): Promise<void> {
  const target = changePath(root, changeName, location);
  if (!(await exists(target))) throw new Error(`OpenSpec change does not exist: ${changeName}`);
  await rm(target, { recursive: true, force: false });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function directoryNames(directoryPath: string): Promise<string[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

const STANDARD_LABELS: Readonly<Record<string, string>> = {
  proposal: "Proposal",
  design: "Design",
  tasks: "Tasks",
};

/** A schema artifact's label from its id: three letters or fewer read as an
 * abbreviation (`adr` → ADR), anything longer as words (`tech-notes` → Tech
 * notes). */
export function labelForSchemaArtifact(id: string): string {
  if (/^[a-z]{1,3}$/iu.test(id)) return id.toUpperCase();
  const words = id.replace(/[-_]+/gu, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The capability path of a delta spec file, or undefined when the relative
 * path is not `specs/<one or more folders>/spec.md`. A `spec.md` directly in
 * `specs/` is not one: the CLI ignores it when a change is applied. */
export function deltaSpecCapability(relativePath: string): string | undefined {
  const parts = relativePath.split("/");
  if (parts.length < 3 || parts[0] !== "specs" || parts[parts.length - 1] !== "spec.md") return undefined;
  return parts.slice(1, -1).join("/");
}

/** A change's artifacts, in the order its schema declares them (ADR 0031).
 * A declared single file is listed whether or not it exists; a glob lists
 * the files it matches. */
async function discoverChangeArtifacts(
  changePath: string,
  projectRoot: string,
  cache: SchemaCache,
  environment: SchemaEnvironment,
): Promise<{ artifacts: WorkbenchArtifact[]; schema: ChangeSchema }> {
  const schema = await resolveChangeSchema(changePath, projectRoot, cache, environment);
  const artifacts: WorkbenchArtifact[] = [];
  const listed = new Set<string>();

  for (const declared of schema.artifacts) {
    const files = await resolveGenerates(changePath, declared.generates);
    const plain = files.length === 1 && files[0] === declared.generates.replace(/\\/gu, "/").replace(/^\.\//u, "");
    for (const relative of files) {
      if (listed.has(relative)) continue;
      listed.add(relative);
      const filePath = path.join(changePath, ...relative.split("/"));
      const fileExists = plain ? await exists(filePath) : true;
      const capability = deltaSpecCapability(relative);
      if (capability !== undefined) {
        artifacts.push({ id: `delta-spec:${capability}`, kind: "delta-spec", label: capability, path: filePath, exists: fileExists });
      } else if (plain && declared.id in STANDARD_LABELS) {
        artifacts.push({
          id: declared.id,
          kind: declared.id as "proposal" | "design" | "tasks",
          label: STANDARD_LABELS[declared.id]!,
          path: filePath,
          exists: fileExists,
        });
      } else if (plain) {
        artifacts.push({
          id: declared.id,
          kind: "schema-artifact",
          label: labelForSchemaArtifact(declared.id),
          path: filePath,
          exists: fileExists,
        });
      } else {
        artifacts.push({ id: `${declared.id}:${relative}`, kind: "schema-artifact", label: relative, path: filePath, exists: fileExists });
      }
    }
  }
  return { artifacts, schema };
}

/** A change's artifacts and schema, for a caller that has only the change's
 * directory: the prompt of an agent run, readiness. The project root is the
 * directory above `openspec/`, whether the change is active or archived. */
export async function listChangeArtifacts(
  changeDir: string,
  options: DiscoverOpenSpecWorkspaceOptions & { projectRoot?: string } = {},
): Promise<{ artifacts: WorkbenchArtifact[]; schema: ChangeSchema }> {
  const resolved = path.resolve(changeDir);
  const parent = path.dirname(resolved);
  const changesRoot = path.basename(parent) === "archive" ? path.dirname(parent) : parent;
  const projectRoot = options.projectRoot ?? path.dirname(path.dirname(changesRoot));
  return discoverChangeArtifacts(resolved, projectRoot, new Map(), options.schemaEnvironment ?? {});
}

async function discoverChanges(
  changesRoot: string,
  archived: boolean,
  projectRoot: string,
  cache: SchemaCache,
  environment: SchemaEnvironment,
): Promise<WorkbenchChange[]> {
  const root = archived ? path.join(changesRoot, "archive") : changesRoot;
  const names = (await directoryNames(root)).filter((name) => archived || name !== "archive");
  return Promise.all(
    names.map(async (name) => {
      const changePath = path.join(root, name);
      const [state, discovered] = await Promise.all([
        readChangeState(changePath),
        discoverChangeArtifacts(changePath, projectRoot, cache, environment),
      ]);
      return {
        name,
        path: changePath,
        state,
        archived,
        artifacts: discovered.artifacts,
        schema: discovered.schema,
      };
    }),
  );
}

export interface DiscoverOpenSpecWorkspaceOptions {
  /** Where the user's OpenSpec schema directory is; tests point it away
   * from the machine's own. */
  schemaEnvironment?: SchemaEnvironment;
}

export async function discoverOpenSpecWorkspace(
  root: string,
  options: DiscoverOpenSpecWorkspaceOptions = {},
): Promise<OpenSpecWorkspace> {
  const resolvedRoot = path.resolve(root);
  const openspecRoot = path.join(resolvedRoot, "openspec");
  const changesRoot = path.join(openspecRoot, "changes");
  const archiveRoot = path.join(changesRoot, "archive");
  const specsRoot = path.join(openspecRoot, "specs");
  const configPath = path.join(openspecRoot, "config.yaml");
  const schemaCache: SchemaCache = new Map();
  const environment = options.schemaEnvironment ?? {};

  const [configExists, changesRootExists, archiveExists, specsRootExists] = await Promise.all([
    exists(configPath),
    exists(changesRoot),
    exists(archiveRoot),
    exists(specsRoot),
  ]);
  const [changes, archivedChanges, specIds] = await Promise.all([
    discoverChanges(changesRoot, false, resolvedRoot, schemaCache, environment),
    discoverChanges(changesRoot, true, resolvedRoot, schemaCache, environment),
    directoryNames(specsRoot),
  ]);
  const specs = await Promise.all(
    specIds.map(async (id): Promise<WorkbenchSpec> => {
      const specPath = path.join(specsRoot, id, "spec.md");
      return { id, path: specPath, exists: await exists(specPath) };
    }),
  );

  return {
    root: resolvedRoot,
    openspecRoot,
    initialized: configExists || changesRootExists || specsRootExists,
    configPath,
    configExists,
    changes,
    archivedChanges,
    specs,
    archiveExists,
    specsRootExists,
  };
}
