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
}

export interface RollbackResult {
  restored: string[];
  conflicts: string[];
}

function hash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function scanWorkspace(root: string, limits: Required<CheckpointLimits>): Promise<Map<string, FileSnapshot>> {
  const files = new Map<string, FileSnapshot>();
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
      if (content.byteLength > limits.maxFileBytes) continue;
      totalBytes += content.byteLength;
      if (files.size >= limits.maxFiles || totalBytes > limits.maxBytes) {
        throw new Error("Workbench checkpoint exceeds configured size limits");
      }
      const relativePath = path.relative(root, absolutePath);
      files.set(relativePath, { hash: hash(content), content });
    }
  }

  await visit(root);
  return files;
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
  return {
    id: randomUUID(),
    root: resolvedRoot,
    createdAt: new Date().toISOString(),
    before: await scanWorkspace(resolvedRoot, resolvedLimits(limits)),
  };
}

export async function finalizeCheckpoint(
  checkpoint: WorkbenchCheckpoint,
  limits: CheckpointLimits = {},
): Promise<CheckpointDelta[]> {
  const after = await scanWorkspace(checkpoint.root, resolvedLimits(limits));
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
