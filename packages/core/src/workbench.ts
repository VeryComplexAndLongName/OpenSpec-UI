import { access, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { mapBounded } from "./bounded-map.js";
import { archivedChangeNames, holdsChangeDocuments, isChangeDirectory } from "./workspace-leftovers.js";
import { readChangeState, type ChangeState } from "./change-state.js";
import {
  assertValidChangeName,
  CHANGE_NAME_PATTERN,
  InvalidChangeNameError,
  isValidChangeName,
} from "./change-name.js";
import {
  isGlobPattern,
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
  /** A file under the change's `specs/` that is not a delta spec. OpenSpec's
   * archive applies only `specs/<capability>/spec.md`, so it drops this one
   * (an-artifact-label-says-what-it-is). */
  notAppliedOnArchive?: true;
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

export interface OpenSpecWorkspace {
  root: string;
  openspecRoot: string;
  initialized: boolean;
  configPath: string;
  configExists: boolean;
  changes: WorkbenchChange[];
  archivedChanges: WorkbenchChange[];
  archiveExists: boolean;
  /** Whether `openspec/specs/` exists. The canonical specs themselves are
   * listed by the OpenSpec CLI (`listSpecs`), which finds them at any depth;
   * core keeps no second, shallower list of them (ADR 0031). */
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

/** The directories under a path, or - with `files` - everything under
 * it, which is what deciding whether a directory holds a document needs. */
async function directoryNames(directoryPath: string, options: { files?: boolean } = {}): Promise<string[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => options.files === true || entry.isDirectory())
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

/** Words written the way their term is written, whatever case an id has
 * (an-artifact-label-says-what-it-is). Nothing in `asyncapi` marks where its
 * words break, so the term has to be known. */
const KNOWN_TERMS: Readonly<Record<string, string>> = {
  api: "API",
  asyncapi: "AsyncAPI",
  openapi: "OpenAPI",
  graphql: "GraphQL",
  grpc: "gRPC",
  json: "JSON",
  yaml: "YAML",
  http: "HTTP",
  sql: "SQL",
  adr: "ADR",
  rfc: "RFC",
  prd: "PRD",
  ui: "UI",
  ux: "UX",
};

/** A schema artifact's label from its id: three letters or fewer read as an
 * abbreviation (`adr` → ADR), anything longer as words (`tech-notes` → Tech
 * notes), with a known term written as the term (`asyncapi` → AsyncAPI). */
export function labelForSchemaArtifact(id: string): string {
  if (/^[a-z]{1,3}$/iu.test(id)) return id.toUpperCase();
  const words = id.split(/[-_]+/u).filter((word) => word !== "");
  return words
    .map((word, index) => {
      const term = KNOWN_TERMS[word.toLowerCase()];
      if (term !== undefined) return term;
      return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(" ");
}

/** The capability path of a delta spec file, or undefined when the relative
 * path is not `specs/<one or more folders>/spec.md`. A `spec.md` directly in
 * `specs/` is not one: the CLI ignores it when a change is applied. */
export function deltaSpecCapability(relativePath: string): string | undefined {
  const parts = relativePath.split("/");
  if (parts.length < 3 || parts[0] !== "specs" || parts[parts.length - 1] !== "spec.md") return undefined;
  return parts.slice(1, -1).join("/");
}

function artifactLabel(id: string): string {
  return STANDARD_LABELS[id] ?? labelForSchemaArtifact(id);
}

/** A matched file's path below the fixed folder of the glob that matched it:
 * the glob's segments before the first with a `*` or `?`. A `specs` glob
 * matching `specs/landing-page.md` gives `landing-page.md`. */
function pathUnderFixedFolder(generates: string, relative: string): string {
  const literal: string[] = [];
  for (const segment of generates.replace(/\\/gu, "/").replace(/^\.\//u, "").split("/")) {
    if (isGlobPattern(segment)) break;
    literal.push(segment);
  }
  const prefix = literal.length > 0 ? `${literal.join("/")}/` : "";
  return prefix !== "" && relative.startsWith(prefix) ? relative.slice(prefix.length) : relative;
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
        continue;
      }
      // OpenSpec's archive merges only specs/<capability>/spec.md; any other
      // file under specs/ is dropped (an-artifact-label-says-what-it-is).
      const dropped = relative.startsWith("specs/") ? { notAppliedOnArchive: true as const } : {};
      if (plain && declared.id in STANDARD_LABELS) {
        artifacts.push({
          id: declared.id,
          kind: declared.id as "proposal" | "design" | "tasks",
          label: STANDARD_LABELS[declared.id]!,
          path: filePath,
          exists: fileExists,
          ...dropped,
        });
      } else if (plain) {
        artifacts.push({
          id: declared.id,
          kind: "schema-artifact",
          label: labelForSchemaArtifact(declared.id),
          path: filePath,
          exists: fileExists,
          ...dropped,
        });
      } else {
        artifacts.push({
          id: `${declared.id}:${relative}`,
          kind: "schema-artifact",
          label: `${artifactLabel(declared.id)}: ${pathUnderFixedFolder(declared.generates, relative)}`,
          path: filePath,
          exists: fileExists,
          ...dropped,
        });
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

/** How many changes one reading of a workspace reads at a time. */
export const CHANGES_READ_AT_ONCE = 16;

async function discoverChanges(
  changesRoot: string,
  archived: boolean,
  projectRoot: string,
  cache: SchemaCache,
  environment: SchemaEnvironment,
  only?: ReadonlySet<string>,
  drafts = false,
): Promise<WorkbenchChange[]> {
  const root = archived ? path.join(changesRoot, "archive") : changesRoot;
  const named = (await directoryNames(root))
    .filter((name) => archived || name !== "archive")
    .filter((name) => only === undefined || only.has(name));
  // A directory carrying no document is not a change, whatever else it
  // holds: archiving leaves one behind whenever the product wrote a file
  // the CLI does not move, and it was listed beside real work with no
  // tasks and no state (the-workspace-clears-what-it-left-behind). The
  // rule is `workspace-leftovers.ts`'s, read rather than restated.
  const archivedNames = drafts && !archived ? await archivedChangeNames(changesRoot) : undefined;
  const names = (await mapBounded(named, CHANGES_READ_AT_ONCE, async (name) => {
    const entries = await directoryNames(path.join(root, name), { files: true });
    const isChange = archivedNames === undefined ? holdsChangeDocuments(entries) : isChangeDirectory(name, entries, archivedNames);
    return isChange ? name : undefined;
  })).filter((name): name is string => name !== undefined);
  // A few changes at a time, not all of them: every change opens several
  // files, and 256 archived changes started together took every file handle
  // the editor's extension host had (the-pipeline-reads-each-workspace-once).
  return mapBounded(names, CHANGES_READ_AT_ONCE, async (name) => {
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
  });
}

export interface DiscoverOpenSpecWorkspaceOptions {
  /** Where the user's OpenSpec schema directory is; tests point it away
   * from the machine's own. */
  schemaEnvironment?: SchemaEnvironment;
  /** Which changes to read: the active ones, the archived ones, or both
   * (the default). The list not read is empty. A caller that looks for one
   * active change need not read every archived one: on this repository the
   * archive is 256 changes and most of a whole reading's 0.8 s, and the
   * Pipeline's survey paid it twice per change per working directory
   * (the-pipeline-reads-each-workspace-once). */
  changes?: "active" | "archived" | "all";
  /** Reads only the changes whose directory has one of these names; the
   * rest of each list is left out. The directories are listed first, so a
   * name that is not there costs nothing. */
  names?: readonly string[];
  /** Also reads the active changes nobody has written a document for yet,
   * whose name was never archived: Drafted, on the Pipeline's board (ADR
   * 0037, amended 2026-09-25). Off by default, since the Changes tree lists
   * them apart, as changes nobody has written yet. */
  drafts?: boolean;
}

/** The changes of a workspace with these names, by name: the active change
 * where one has the name, otherwise the archived one. Only the named
 * directories are read. A process history names dozens of changes, most of
 * them long archived under a dated folder name no process used; asked one by
 * one, each missing name read the whole archive
 * (the-pipeline-reads-each-workspace-once). */
export async function readChangesNamed(
  root: string,
  names: readonly string[],
  options: Pick<DiscoverOpenSpecWorkspaceOptions, "schemaEnvironment"> = {},
): Promise<Map<string, WorkbenchChange>> {
  const found = new Map<string, WorkbenchChange>();
  if (names.length === 0) return found;
  const workspace = await discoverOpenSpecWorkspace(root, { ...options, names });
  for (const change of [...workspace.changes, ...workspace.archivedChanges]) {
    if (!found.has(change.name)) found.set(change.name, change);
  }
  return found;
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
  const which = options.changes ?? "all";
  const only = options.names === undefined ? undefined : new Set(options.names);
  const [changes, archivedChanges] = await Promise.all([
    which === "archived" ? [] : discoverChanges(changesRoot, false, resolvedRoot, schemaCache, environment, only, options.drafts === true),
    which === "active" ? [] : discoverChanges(changesRoot, true, resolvedRoot, schemaCache, environment, only),
  ]);

  return {
    root: resolvedRoot,
    openspecRoot,
    initialized: configExists || changesRootExists || specsRootExists,
    configPath,
    configExists,
    changes,
    archivedChanges,
    archiveExists,
    specsRootExists,
  };
}
