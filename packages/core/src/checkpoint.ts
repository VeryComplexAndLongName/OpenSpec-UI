import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".openspec-ui",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".vscode-test",
]);

export interface CheckpointLimits {
  maxFiles?: number;
  maxBytes?: number;
  maxFileBytes?: number;
}

interface FileSnapshot {
  hash: string;
  content: Buffer;
}

export interface CheckpointCoverage {
  excludedDirectories: string[];
  skippedFiles: string[];
}

export interface CheckpointDelta {
  path: string;
  kind: "added" | "modified" | "deleted";
  beforeHash?: string;
  afterHash?: string;
}

export interface WorkbenchCheckpoint {
  id: string;
  root: string;
  createdAt: string;
  before: Map<string, FileSnapshot>;
  after?: Map<string, FileSnapshot>;
  delta?: CheckpointDelta[];
  coverage: CheckpointCoverage;
}

export interface SerializedWorkbenchCheckpoint {
  version: 1;
  id: string;
  root: string;
  createdAt: string;
  before: SerializedFileSnapshot[];
  after?: SerializedFileSnapshot[];
  delta?: CheckpointDelta[];
  coverage: CheckpointCoverage;
}

interface SerializedFileSnapshot {
  path: string;
  hash: string;
  content: string;
}

export interface RollbackResult {
  restored: string[];
  conflicts: string[];
}

function hash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

interface WorkspaceScan {
  files: Map<string, FileSnapshot>;
  skippedFiles: string[];
}

async function scanWorkspace(root: string, limits: Required<CheckpointLimits>): Promise<WorkspaceScan> {
  const files = new Map<string, FileSnapshot>();
  const skippedFiles: string[] = [];
  let totalBytes = 0;

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!DEFAULT_EXCLUDED_DIRECTORIES.has(entry.name)) await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const content = await readFile(absolutePath);
      const relativePath = path.relative(root, absolutePath);
      if (content.byteLength > limits.maxFileBytes) {
        skippedFiles.push(relativePath);
        continue;
      }
      totalBytes += content.byteLength;
      if (files.size >= limits.maxFiles || totalBytes > limits.maxBytes) {
        throw new Error("Workbench checkpoint exceeds configured size limits");
      }
      files.set(relativePath, { hash: hash(content), content });
    }
  }

  await visit(root);
  return { files, skippedFiles };
}

function resolvedLimits(limits: CheckpointLimits): Required<CheckpointLimits> {
  return {
    maxFiles: limits.maxFiles ?? 2_000,
    maxBytes: limits.maxBytes ?? 20 * 1024 * 1024,
    maxFileBytes: limits.maxFileBytes ?? 1024 * 1024,
  };
}

export async function captureCheckpoint(
  root: string,
  limits: CheckpointLimits = {},
): Promise<WorkbenchCheckpoint> {
  const resolvedRoot = path.resolve(root);
  const scan = await scanWorkspace(resolvedRoot, resolvedLimits(limits));
  return {
    id: randomUUID(),
    root: resolvedRoot,
    createdAt: new Date().toISOString(),
    before: scan.files,
    coverage: {
      excludedDirectories: [...DEFAULT_EXCLUDED_DIRECTORIES].sort(),
      skippedFiles: scan.skippedFiles.sort(),
    },
  };
}

export async function finalizeCheckpoint(
  checkpoint: WorkbenchCheckpoint,
  limits: CheckpointLimits = {},
): Promise<CheckpointDelta[]> {
  const scan = await scanWorkspace(checkpoint.root, resolvedLimits(limits));
  const after = scan.files;
  checkpoint.coverage.skippedFiles = [...new Set([
    ...checkpoint.coverage.skippedFiles,
    ...scan.skippedFiles,
  ])].sort();
  const paths = new Set([...checkpoint.before.keys(), ...after.keys()]);
  const delta: CheckpointDelta[] = [];
  for (const relativePath of [...paths].sort()) {
    const beforeFile = checkpoint.before.get(relativePath);
    const afterFile = after.get(relativePath);
    if (beforeFile?.hash === afterFile?.hash) continue;
    delta.push({
      path: relativePath,
      kind: beforeFile ? (afterFile ? "modified" : "deleted") : "added",
      beforeHash: beforeFile?.hash,
      afterHash: afterFile?.hash,
    });
  }
  checkpoint.after = after;
  checkpoint.delta = delta;
  return delta;
}

function serializeFiles(files: Map<string, FileSnapshot>): SerializedFileSnapshot[] {
  return [...files.entries()].map(([filePath, snapshot]) => ({
    path: filePath,
    hash: snapshot.hash,
    content: snapshot.content.toString("base64"),
  }));
}

function assertSafeRelativePath(filePath: string): void {
  if (!filePath || path.isAbsolute(filePath) || filePath.split(/[\\/]/).includes("..")) {
    throw new Error(`Invalid checkpoint path: ${filePath}`);
  }
}

function deserializeFiles(files: SerializedFileSnapshot[]): Map<string, FileSnapshot> {
  return new Map(files.map((file) => {
    assertSafeRelativePath(file.path);
    const content = Buffer.from(file.content, "base64");
    if (hash(content) !== file.hash) throw new Error(`Checkpoint content hash mismatch: ${file.path}`);
    return [file.path, { hash: file.hash, content }];
  }));
}

export function serializeCheckpoint(checkpoint: WorkbenchCheckpoint): SerializedWorkbenchCheckpoint {
  return {
    version: 1,
    id: checkpoint.id,
    root: checkpoint.root,
    createdAt: checkpoint.createdAt,
    before: serializeFiles(checkpoint.before),
    after: checkpoint.after ? serializeFiles(checkpoint.after) : undefined,
    delta: checkpoint.delta?.map((item) => ({ ...item })),
    coverage: {
      excludedDirectories: [...checkpoint.coverage.excludedDirectories],
      skippedFiles: [...checkpoint.coverage.skippedFiles],
    },
  };
}

export function deserializeCheckpoint(serialized: SerializedWorkbenchCheckpoint): WorkbenchCheckpoint {
  if (serialized.version !== 1) throw new Error(`Unsupported checkpoint version: ${String(serialized.version)}`);
  for (const item of serialized.delta ?? []) assertSafeRelativePath(item.path);
  return {
    id: serialized.id,
    root: path.resolve(serialized.root),
    createdAt: serialized.createdAt,
    before: deserializeFiles(serialized.before),
    after: serialized.after ? deserializeFiles(serialized.after) : undefined,
    delta: serialized.delta?.map((item) => ({ ...item })),
    coverage: {
      excludedDirectories: [...serialized.coverage.excludedDirectories],
      skippedFiles: [...serialized.coverage.skippedFiles],
    },
  };
}

async function currentHash(filePath: string): Promise<string | undefined> {
  try {
    return hash(await readFile(filePath));
  } catch {
    return undefined;
  }
}

export async function rollbackCheckpoint(checkpoint: WorkbenchCheckpoint): Promise<RollbackResult> {
  if (!checkpoint.after || !checkpoint.delta) throw new Error("Checkpoint must be finalized before rollback");
  const conflicts: string[] = [];
  for (const delta of checkpoint.delta) {
    const absolutePath = path.join(checkpoint.root, delta.path);
    if (await currentHash(absolutePath) !== delta.afterHash) conflicts.push(delta.path);
  }
  if (conflicts.length > 0) return { restored: [], conflicts };

  const restored: string[] = [];
  for (const delta of checkpoint.delta) {
    const absolutePath = path.join(checkpoint.root, delta.path);
    const beforeFile = checkpoint.before.get(delta.path);
    if (!beforeFile) {
      await rm(absolutePath, { force: true });
    } else {
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, beforeFile.content);
    }
    restored.push(delta.path);
  }
  return { restored, conflicts: [] };
}
