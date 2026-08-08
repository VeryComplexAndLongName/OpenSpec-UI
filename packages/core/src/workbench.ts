import { access, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { readChangeState, type ChangeState } from "./change-state.js";

export type ChangeArtifactKind = "proposal" | "design" | "tasks" | "delta-spec";

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

const CHANGE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export function assertValidChangeName(changeName: string): void {
  if (!CHANGE_NAME_PATTERN.test(changeName) || changeName === "." || changeName === "..") {
    throw new Error(`Invalid OpenSpec change name: ${changeName}`);
  }
}

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

async function discoverChangeArtifacts(changePath: string): Promise<WorkbenchArtifact[]> {
  const standardArtifacts: Array<{ id: string; kind: ChangeArtifactKind; label: string; file: string }> = [
    { id: "proposal", kind: "proposal", label: "Proposal", file: "proposal.md" },
    { id: "design", kind: "design", label: "Design", file: "design.md" },
    { id: "tasks", kind: "tasks", label: "Tasks", file: "tasks.md" },
  ];
  const artifacts = await Promise.all(
    standardArtifacts.map(async (artifact) => {
      const artifactPath = path.join(changePath, artifact.file);
      return { ...artifact, path: artifactPath, exists: await exists(artifactPath) };
    }),
  );

  const specsPath = path.join(changePath, "specs");
  const specIds = await directoryNames(specsPath);
  const deltaSpecs = await Promise.all(
    specIds.map(async (specId): Promise<WorkbenchArtifact> => {
      const specPath = path.join(specsPath, specId, "spec.md");
      return {
        id: `delta-spec:${specId}`,
        kind: "delta-spec",
        label: specId,
        path: specPath,
        exists: await exists(specPath),
      };
    }),
  );
  return [...artifacts, ...deltaSpecs];
}

async function discoverChanges(changesRoot: string, archived: boolean): Promise<WorkbenchChange[]> {
  const root = archived ? path.join(changesRoot, "archive") : changesRoot;
  const names = (await directoryNames(root)).filter((name) => archived || name !== "archive");
  return Promise.all(
    names.map(async (name) => {
      const changePath = path.join(root, name);
      return {
        name,
        path: changePath,
        state: await readChangeState(changePath),
        archived,
        artifacts: await discoverChangeArtifacts(changePath),
      };
    }),
  );
}

export async function discoverOpenSpecWorkspace(root: string): Promise<OpenSpecWorkspace> {
  const resolvedRoot = path.resolve(root);
  const openspecRoot = path.join(resolvedRoot, "openspec");
  const changesRoot = path.join(openspecRoot, "changes");
  const archiveRoot = path.join(changesRoot, "archive");
  const specsRoot = path.join(openspecRoot, "specs");
  const configPath = path.join(openspecRoot, "config.yaml");

  const [configExists, changesRootExists, archiveExists, specsRootExists] = await Promise.all([
    exists(configPath),
    exists(changesRoot),
    exists(archiveRoot),
    exists(specsRoot),
  ]);
  const [changes, archivedChanges, specIds] = await Promise.all([
    discoverChanges(changesRoot, false),
    discoverChanges(changesRoot, true),
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
