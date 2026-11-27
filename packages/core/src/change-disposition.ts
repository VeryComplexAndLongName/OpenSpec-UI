import { createHash } from "node:crypto";
import { lstat, open, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { isValidChangeName } from "./change-name.js";
import { pathKey } from "./path-key.js";
import { lastDisposition, type ChangeDisposition, type ChangeDispositionRequest } from "./change-disposition-facts.js";

export const CHANGE_DISPOSITION_FILE = "workbench-disposition.json";
const MAX_BYTES = 128 * 1024;
const state = z.enum(["active", "deferred", "cancelled"]);
const reason = z.string().trim().min(1).max(400);
const decision = z.object({ state, reason, at: z.string().datetime() }).strict();
const record = z.object({ version: z.literal(1), history: z.array(decision).min(1) }).strict();
const request = z.object({ revision: z.string(), state, reason }).strict();

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

function emptyDisposition(): ChangeDisposition {
  return { revision: "", history: [] };
}

export function parseChangeDisposition(source: string): ChangeDisposition {
  if (Buffer.byteLength(source) > MAX_BYTES) throw new Error(`${CHANGE_DISPOSITION_FILE} is too large.`);
  const { history } = record.parse(JSON.parse(source));
  return { revision: createHash("sha256").update(source).digest("hex"), history };
}

async function changeDirectory(root: string, change: string): Promise<string> {
  if (!isValidChangeName(change) || change === "archive") throw new Error("Choose an active OpenSpec change.");
  const directory = path.join(await realpath(root), "openspec", "changes", change);
  if (pathKey(await realpath(directory)) !== pathKey(directory) || !(await lstat(directory)).isDirectory()) {
    throw new Error("The change directory must be in this workspace.");
  }
  return directory;
}

async function readAt(filename: string): Promise<ChangeDisposition> {
  try {
    const info = await lstat(filename);
    if (!info.isFile() || info.size > MAX_BYTES) throw new Error(`${CHANGE_DISPOSITION_FILE} must be a regular file up to 128 KiB.`);
    const handle = await open(filename, "r");
    try {
      // Bound the read even if the file grows after the stat.
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      let size = 0;
      while (size < buffer.length) {
        const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size);
        if (bytesRead === 0) break;
        size += bytesRead;
      }
      if (size > MAX_BYTES) throw new Error(`${CHANGE_DISPOSITION_FILE} is too large.`);
      return parseChangeDisposition(buffer.subarray(0, size).toString("utf8"));
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (missing(error)) return emptyDisposition();
    throw error;
  }
}

export async function readChangeDisposition(root: string, change: string): Promise<ChangeDisposition> {
  try {
    if (!isValidChangeName(change) || change === "archive") throw new Error("Choose an active OpenSpec change.");
    await lstat(path.join(root, "openspec", "changes", change, CHANGE_DISPOSITION_FILE));
    const directory = await changeDirectory(root, change);
    return await readAt(path.join(directory, CHANGE_DISPOSITION_FILE));
  } catch (error) {
    if (missing(error)) return emptyDisposition();
    throw error;
  }
}

export async function setChangeDisposition(root: string, change: string, input: ChangeDispositionRequest): Promise<ChangeDisposition> {
  const edit = request.parse(input);
  const directory = await changeDirectory(root, change);
  const filename = path.join(directory, CHANGE_DISPOSITION_FILE);
  const pending = filename + ".pending";
  const handle = await open(pending, "wx");
  let moved = false;
  try {
    const current = await readAt(filename);
    if (current.revision !== edit.revision) throw new Error("This change's disposition changed. Reopen the action and try again.");
    if ((lastDisposition(current)?.state ?? "active") === edit.state) throw new Error("Choose a different disposition.");
    const history = [...current.history, { state: edit.state, reason: edit.reason, at: new Date().toISOString() }];
    const content = JSON.stringify({ version: 1, history }, null, 2) + "\n";
    const next = parseChangeDisposition(content);
    await handle.writeFile(content, "utf8");
    await handle.close();
    await rename(pending, filename);
    moved = true;
    return next;
  } finally {
    await handle.close();
    if (!moved) await unlink(pending).catch((error: unknown) => {
      if (!missing(error)) throw error;
    });
  }
}

export async function assertActiveDisposition(root: string, change: string): Promise<void> {
  const disposition = lastDisposition(await readChangeDisposition(root, change));
  if (disposition !== undefined && disposition.state !== "active") {
    throw new Error(`Restore the ${disposition.state} change before running or archiving it.`);
  }
}
