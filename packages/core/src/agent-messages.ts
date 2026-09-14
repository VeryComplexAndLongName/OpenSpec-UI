// A request to stop a run elsewhere — ADR 0028, "A stop is a recommendation",
// and ADR 0029, "A run elsewhere is reached only through ADR-0028's signed
// channel" (a-run-elsewhere-can-be-asked-to-stop).
//
// A request is a file of its own, beside the status and roster directories
// and inside no working directory (ADR 0026 amendment). The person asking
// writes it, sealed with their machine key; the run it names reads it at
// renewal and acts on it only when it is verified, fresh and new.

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MachineKey } from "./machine-key.js";
import type { EnrolledPerson } from "./signature-facts.js";
import { openEnvelope, sealEnvelope, type Roster } from "./signed-envelope.js";

export const STOP_MESSAGE_VERSION = 1;

/** How long a request stays fresh after it was sent. Past this, a run that
 * reads it refuses it as stale: a request kept for later is not the request
 * a person made. */
export const STOP_MESSAGE_STALE_AFTER_MS = 60_000;

/** Where every request to a repository's runs is written: beside
 * `.agent-status` and `.agent-roster`, inside no working directory. */
export function agentMessageDirectory(worktreeRoot: string, repositoryRoot: string): string {
  return path.join(path.resolve(worktreeRoot), path.basename(path.resolve(repositoryRoot)), ".agent-messages");
}

/** The message directory beside a status directory: the same parent. */
export function messageDirectoryBeside(statusDirectory: string): string {
  return path.join(path.dirname(path.resolve(statusDirectory)), ".agent-messages");
}

/** A request to stop, as signed. Everything but the signature is claimed:
 * the machine and git author say who wrote it, and only the roster says who
 * that is. */
export interface StopMessage {
  version: typeof STOP_MESSAGE_VERSION;
  messageId: string;
  kind: "stop";
  /** The instance id of the run it asks, from that run's status record. */
  to: string;
  reason: string;
  sentAt: string;
  machine: string;
  gitAuthor?: string;
}

/** Why a request addressed to a run was not acted on. */
export type StopRequestRefusal = "unverified" | "stale" | "seen";

export type StopRequestReading =
  | { state: "act"; message: StopMessage; person: EnrolledPerson }
  | { state: "refused"; message: StopMessage; why: StopRequestRefusal };

export interface AskRunToStopOptions {
  directory: string;
  to: string;
  reason: string;
  key: Pick<MachineKey, "keyId" | "publicKey" | "sign">;
  machine: string;
  gitAuthor?: string;
  /** Test seams. */
  now?: () => Date;
  messageId?: string;
}

/** Writes a request to stop, sealed with the asker's key, and returns its
 * message id. Written through a temporary name and a rename, so a run never
 * reads half a request. */
export async function askRunToStop(options: AskRunToStopOptions): Promise<string> {
  const messageId = options.messageId ?? randomUUID();
  const message: StopMessage = {
    version: STOP_MESSAGE_VERSION,
    messageId,
    kind: "stop",
    to: options.to,
    reason: options.reason,
    sentAt: (options.now ?? (() => new Date()))().toISOString(),
    machine: options.machine,
    ...(options.gitAuthor !== undefined ? { gitAuthor: options.gitAuthor } : {}),
  };
  const bytes = Buffer.from(`${JSON.stringify(message, null, 2)}\n`, "utf8");
  const written = `${JSON.stringify(sealEnvelope(bytes, options.key), null, 2)}\n`;
  const directory = path.resolve(options.directory);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${messageId}.json`);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, written, "utf8");
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
  return messageId;
}

/** A payload as a request holds it, or `undefined` for one that is not a
 * well-formed stop message. */
function readStopMessage(value: unknown): StopMessage | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const message = value as Record<string, unknown>;
  if (message.version !== STOP_MESSAGE_VERSION || message.kind !== "stop") return undefined;
  if (typeof message.messageId !== "string" || typeof message.to !== "string") return undefined;
  if (typeof message.reason !== "string" || typeof message.sentAt !== "string" || typeof message.machine !== "string") return undefined;
  if (!Number.isFinite(Date.parse(message.sentAt))) return undefined;
  if (message.gitAuthor !== undefined && typeof message.gitAuthor !== "string") return undefined;
  return {
    version: STOP_MESSAGE_VERSION,
    messageId: message.messageId,
    kind: "stop",
    to: message.to,
    reason: message.reason,
    sentAt: message.sentAt,
    machine: message.machine,
    ...(typeof message.gitAuthor === "string" ? { gitAuthor: message.gitAuthor } : {}),
  };
}

/** The request file names in a directory: one per message, temporary files
 * left out. A directory that does not exist holds none. */
async function requestFileNames(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export interface ReadStopRequestsOptions {
  directory: string;
  /** The run reading: only requests addressed to it are returned. */
  instanceId: string;
  roster: Roster;
  now: Date;
  /** The message ids this run has already read. */
  seen: ReadonlySet<string>;
}

/** The requests addressed to one run, each with what the run does about it.
 *
 * A payload is parsed only once its envelope opens (ADR 0028). A file whose
 * envelope does not check out is never parsed, so nothing says which run it
 * was meant for, and it is returned for no run: `readUnopenedRequests` lists
 * it instead. A file whose payload is not a stop message, or whose message
 * id is not its file name, is not a request to anybody. */
export async function readStopRequests(options: ReadStopRequestsOptions): Promise<StopRequestReading[]> {
  const readings: StopRequestReading[] = [];
  for (const fileName of await requestFileNames(options.directory)) {
    let text: string;
    try {
      text = await readFile(path.join(options.directory, fileName), "utf8");
    } catch {
      // Removed by a sweep, or not yet renamed into place: the next renewal
      // reads it, or nobody needs to.
      continue;
    }
    const opened = openEnvelope(text, options.roster);
    if (opened.state === "does-not-check-out") continue;
    let message: StopMessage | undefined;
    try {
      message = readStopMessage(JSON.parse(Buffer.from(opened.bytes).toString("utf8")));
    } catch {
      message = undefined;
    }
    if (message === undefined || message.messageId !== fileName.slice(0, -".json".length)) continue;
    if (message.to !== options.instanceId) continue;

    if (opened.state !== "verified") {
      readings.push({ state: "refused", message, why: "unverified" });
    } else if (options.seen.has(message.messageId)) {
      readings.push({ state: "refused", message, why: "seen" });
    } else if (Math.abs(options.now.getTime() - Date.parse(message.sentAt)) > STOP_MESSAGE_STALE_AFTER_MS) {
      // Too old, or dated too far ahead to be believed: either way not a
      // request made just now.
      readings.push({ state: "refused", message, why: "stale" });
    } else {
      readings.push({ state: "act", message, person: opened.person });
    }
  }
  return readings;
}

/** The file names of requests whose envelope does not check out. Nobody can
 * say which run such a request was for, so it is reported by name, beneath
 * the runs, and never as any run's own. */
export async function readUnopenedRequests(directory: string, roster: Roster): Promise<string[]> {
  const unopened: string[] = [];
  for (const fileName of await requestFileNames(directory)) {
    let text: string;
    try {
      text = await readFile(path.join(directory, fileName), "utf8");
    } catch {
      continue;
    }
    if (openEnvelope(text, roster).state === "does-not-check-out") unopened.push(fileName);
  }
  return unopened;
}
