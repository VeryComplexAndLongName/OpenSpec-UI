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

/** One file's target restore state: `beforeContent` undefined means the
 * file should not exist after restore (delete). `expectedCurrentHash` is
 * the hash the file is expected to have on disk right now — a mismatch
 * means something changed it after the checkpoint(s) this restore is
 * based on, and the whole restore is refused (fail-closed), matching
 * `rollbackCheckpoint`'s existing per-process behavior. */
export interface RestoreEntry {
  path: string;
  beforeContent?: Buffer;
  expectedCurrentHash?: string;
}

export async function restoreFiles(root: string, entries: RestoreEntry[]): Promise<RollbackResult> {
  const conflicts: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.path);
    if (await currentHash(absolutePath) !== entry.expectedCurrentHash) conflicts.push(entry.path);
  }
  if (conflicts.length > 0) return { restored: [], conflicts };

  const restored: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.path);
    if (!entry.beforeContent) {
      await rm(absolutePath, { force: true });
    } else {
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, entry.beforeContent);
    }
    restored.push(entry.path);
  }
  return { restored, conflicts: [] };
}

export async function rollbackCheckpoint(checkpoint: WorkbenchCheckpoint): Promise<RollbackResult> {
  if (!checkpoint.after || !checkpoint.delta) throw new Error("Checkpoint must be finalized before rollback");
  const entries: RestoreEntry[] = checkpoint.delta.map((delta) => ({
    path: delta.path,
    beforeContent: checkpoint.before.get(delta.path)?.content,
    expectedCurrentHash: delta.afterHash,
  }));
  return restoreFiles(checkpoint.root, entries);
}

/** Aggregates every finalized checkpoint belonging to one Change into a
 * single restore: each file's target is its content from the *earliest*
 * checkpoint that touched it (i.e. "undo everything ever done under this
 * Change"), and the conflict check compares against each file's *latest*
 * known `afterHash` — the most recent state this restore actually knows
 * about. Same fail-closed, all-or-nothing semantics as
 * `rollbackCheckpoint`: any conflict refuses the entire restore, not just
 * the conflicting file. Callers (`WorkbenchRecoveryService`,
 * `ImplementationSessionManager`) are responsible for selecting which
 * checkpoints belong to a Change and are rollback-eligible — this
 * function only does the aggregation + restore. */
export async function rollbackChangeCheckpoints(checkpoints: WorkbenchCheckpoint[]): Promise<RollbackResult> {
  if (checkpoints.length === 0) throw new Error("No checkpoints to roll back");
  const ordered = [...checkpoints].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const root = ordered[0]!.root;

  const earliestBefore = new Map<string, Buffer | undefined>();
  const latestAfterHash = new Map<string, string | undefined>();
  for (const checkpoint of ordered) {
    if (!checkpoint.after || !checkpoint.delta) throw new Error("Checkpoint must be finalized before rollback");
    for (const delta of checkpoint.delta) {
      if (!earliestBefore.has(delta.path)) {
        earliestBefore.set(delta.path, checkpoint.before.get(delta.path)?.content);
      }
      latestAfterHash.set(delta.path, delta.afterHash);
    }
  }

  const entries: RestoreEntry[] = [...latestAfterHash.keys()].sort().map((filePath) => ({
    path: filePath,
    beforeContent: earliestBefore.get(filePath),
    expectedCurrentHash: latestAfterHash.get(filePath),
  }));
  return restoreFiles(root, entries);
}
