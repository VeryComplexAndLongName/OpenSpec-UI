import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ChangeEditorFiles {
  proposal: string;
  design: string;
  tasks: string;
  spec: string;
}

export interface ChangeEditorDocument {
  changeName: string;
  files: ChangeEditorFiles;
  revision: string;
}

export interface ChangeEditorFileSystem {
  mkdir: typeof mkdir;
  readFile: typeof readFile;
  rename: typeof rename;
  rm: typeof rm;
  writeFile: typeof writeFile;
}

export interface ChangeEditorStoreOptions {
  fileSystem?: Partial<ChangeEditorFileSystem>;
  transactionId?: () => string;
}

interface Artifact {
  key: keyof ChangeEditorFiles;
  filePath: string;
}

interface ArtifactSnapshot extends Artifact {
  content: string;
  exists: boolean;
}

const nodeFileSystem: ChangeEditorFileSystem = { mkdir, readFile, rename, rm, writeFile };

export class ChangeEditorConflictError extends Error {
  constructor() {
    super("Change editor files changed after they were loaded");
    this.name = "ChangeEditorConflictError";
  }
}

function assertChangeName(changeName: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(changeName)) {
    throw new Error("Invalid change name");
  }
}

function artifacts(workspaceRoot: string, changeName: string): Artifact[] {
  assertChangeName(changeName);
  const changeRoot = path.resolve(workspaceRoot, "openspec", "changes", changeName);
  return [
    { key: "proposal", filePath: path.join(changeRoot, "proposal.md") },
    { key: "design", filePath: path.join(changeRoot, "design.md") },
    { key: "tasks", filePath: path.join(changeRoot, "tasks.md") },
    { key: "spec", filePath: path.join(changeRoot, "specs", changeName, "spec.md") },
  ];
}

async function readArtifact(
  artifact: Artifact,
  fileSystem: ChangeEditorFileSystem,
): Promise<ArtifactSnapshot> {
  try {
    return { ...artifact, content: await fileSystem.readFile(artifact.filePath, "utf8"), exists: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...artifact, content: "", exists: false };
    }
    throw error;
  }
}

function revisionOf(files: ChangeEditorFiles): string {
  const hash = createHash("sha256");
  for (const key of ["proposal", "design", "tasks", "spec"] as const) {
    hash.update(key).update("\0").update(files[key]).update("\0");
  }
  return hash.digest("hex");
}

async function readSnapshot(
  workspaceRoot: string,
  changeName: string,
  fileSystem: ChangeEditorFileSystem,
): Promise<{ snapshots: ArtifactSnapshot[]; files: ChangeEditorFiles }> {
  const snapshots = await Promise.all(
    artifacts(workspaceRoot, changeName).map((artifact) => readArtifact(artifact, fileSystem)),
  );
  const files = Object.fromEntries(
    snapshots.map((snapshot) => [snapshot.key, snapshot.content]),
  ) as unknown as ChangeEditorFiles;
  return { snapshots, files };
}

function resolveFileSystem(options: ChangeEditorStoreOptions): ChangeEditorFileSystem {
  return { ...nodeFileSystem, ...options.fileSystem };
}

export async function readChangeEditorDocument(
  workspaceRoot: string,
  changeName: string,
  options: ChangeEditorStoreOptions = {},
): Promise<ChangeEditorDocument> {
  const { files } = await readSnapshot(workspaceRoot, changeName, resolveFileSystem(options));
  return { changeName, files, revision: revisionOf(files) };
}

export async function saveChangeEditorDocument(
  workspaceRoot: string,
  changeName: string,
  files: ChangeEditorFiles,
  expectedRevision: string,
  options: ChangeEditorStoreOptions = {},
): Promise<ChangeEditorDocument> {
  const fileSystem = resolveFileSystem(options);
  const { snapshots, files: currentFiles } = await readSnapshot(workspaceRoot, changeName, fileSystem);
  if (revisionOf(currentFiles) !== expectedRevision) throw new ChangeEditorConflictError();

  const transactionId = options.transactionId?.() ?? randomUUID();
  const staged = new Map<string, string>();
  const backups = new Map<string, string>();
  const replaced = new Set<string>();

  try {
    await Promise.all(snapshots.map(async (snapshot) => {
      await fileSystem.mkdir(path.dirname(snapshot.filePath), { recursive: true });
      const stagedPath = `${snapshot.filePath}.openspec-ui-${transactionId}.new`;
      await fileSystem.writeFile(stagedPath, files[snapshot.key], "utf8");
      staged.set(snapshot.filePath, stagedPath);
    }));

    for (const snapshot of snapshots) {
      if (snapshot.exists) {
        const backupPath = `${snapshot.filePath}.openspec-ui-${transactionId}.bak`;
        await fileSystem.rename(snapshot.filePath, backupPath);
        backups.set(snapshot.filePath, backupPath);
      }
      await fileSystem.rename(staged.get(snapshot.filePath)!, snapshot.filePath);
      replaced.add(snapshot.filePath);
    }
  } catch (error) {
    const restoreErrors: unknown[] = [];
    for (const snapshot of [...snapshots].reverse()) {
      try {
        if (replaced.has(snapshot.filePath)) {
          await fileSystem.rm(snapshot.filePath, { force: true });
        }
        const backupPath = backups.get(snapshot.filePath);
        if (backupPath) await fileSystem.rename(backupPath, snapshot.filePath);
      } catch (restoreError) {
        restoreErrors.push(restoreError);
      }
    }
    await Promise.allSettled([...staged.values()].map((filePath) => fileSystem.rm(filePath, { force: true })));
    if (restoreErrors.length > 0) {
      throw new AggregateError([error, ...restoreErrors], "Change editor save and rollback failed");
    }
    throw error;
  }

  await Promise.allSettled([...backups.values()].map((filePath) => fileSystem.rm(filePath, { force: true })));
  return { changeName, files: { ...files }, revision: revisionOf(files) };
}