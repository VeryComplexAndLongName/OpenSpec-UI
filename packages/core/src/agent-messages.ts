// What one run, or one person, says to another — ADR 0028, "A stop is a
// recommendation", and ADR 0029, "A run elsewhere is reached only through
// ADR-0028's signed channel".
//
// A message is a file of its own, beside the status and roster directories
// and inside no working directory (ADR 0026 amendment). The sender writes
// it, sealed with their machine key; whoever it names reads it at renewal
// and acts on it only when it is verified, fresh and new.
//
// Two shapes share the directory. A `stop` is a request about now, and goes
// stale in a minute. A `note`, an `ask` and an `answer` are a conversation:
// they are written precisely because the receiver is busy, so they wait a
// day and go when they are delivered, not when the clock says
// (the-operator-can-say-something-to-a-run).

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { readAgentRoster, rosterDirectoryBeside, rosterOf } from "./agent-roster.js";
import { loadOrCreateMachineKey, type MachineKey } from "./machine-key.js";
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
  /** The task of the change to finish before stopping, as `tasks.md`
   * writes it (for example `4.6`). Absent asks the run to stop at the
   * next sound point, which is what a stop has always meant
   * (a-run-is-told-where-to-stop). */
  afterTask?: string;
  sentAt: string;
  machine: string;
  gitAuthor?: string;
}

/** What a task number looks like in a task list: two or more numbers,
 * separated by dots. Checked where the request is written and again where
 * it is read, since neither end trusts the other. */
const TASK_NUMBER = /^\d+(?:\.\d+)+$/u;

export function isTaskNumber(value: string): boolean {
  return TASK_NUMBER.test(value.trim());
}

/** Why a request addressed to a run was not acted on. */
export type StopRequestRefusal = "unverified" | "stale" | "seen";

export const CONVERSATION_VERSION = 1;

/** How long a note, a question or an answer stays fresh.
 *
 * A day, not the stop request's minute. A stop kept for later is not the
 * request a person made; a note is the opposite - it is left because the
 * run is busy, and the run may be minutes from the stage that will read
 * it. What removes a conversation message is delivery, not the clock; this
 * window only stops a directory nobody swept from growing without end. */
export const CONVERSATION_STALE_AFTER_MS = 24 * 60 * 60_000;

/** What a message is for. `note` expects no reply and `ask` expects one;
 * they are two kinds rather than one with a flag, so a reader of an audit
 * entry never has to read a boolean to know whether somebody is waiting. */
export type ConversationKind = "note" | "ask" | "answer";

/** What kind of sender claimed to write a message.
 *
 * A claim, like `machine` and `gitAuthor` beside it: the signature and the
 * roster are what establish who. It is here so a receiver can refuse every
 * run-authored message without opening the words. A person and their run
 * sign with the same machine key by design (ADR 0028, one key per person
 * per machine), so the key itself cannot tell them apart. */
export type MessageAuthor = "person" | "run";

/** A note, a question or an answer, as signed. */
export interface ConversationMessage {
  version: typeof CONVERSATION_VERSION;
  messageId: string;
  kind: ConversationKind;
  /** A run's instance id, or a person's key id as the roster holds it. */
  to: string;
  toKind: "run" | "person";
  author: MessageAuthor;
  /** What was said. Carried to an agent as words from a person, never as
   * content read out of the repository. */
  words: string;
  /** The message this answers, for an `answer`. */
  answers?: string;
  /** The stage whose words these are, and the run that spoke them, for an
   * `answer`. */
  stage?: string;
  runId?: string;
  sentAt: string;
  machine: string;
  gitAuthor?: string;
}

/** Why a conversation message was not acted on. The first three are the
 * stop request's own reasons; the last is a run refusing another run. */
export type ConversationRefusal = StopRequestRefusal | "author-not-allowed";

export type ConversationReading =
  | { state: "act"; message: ConversationMessage; person: EnrolledPerson }
  | { state: "refused"; message: ConversationMessage; why: ConversationRefusal };

export interface SendMessageOptions {
  directory: string;
  to: string;
  toKind: "run" | "person";
  kind: ConversationKind;
  author: MessageAuthor;
  words: string;
  answers?: string;
  stage?: string;
  runId?: string;
  key: Pick<MachineKey, "keyId" | "publicKey" | "sign">;
  machine: string;
  gitAuthor?: string;
  /** Test seams. */
  now?: () => Date;
  messageId?: string;
}

/** Writes a note, a question or an answer, sealed with the sender's key,
 * and returns its message id. Written through a temporary name and a
 * rename, so nobody ever reads half a message. */
export async function sendMessage(options: SendMessageOptions): Promise<string> {
  const words = options.words.trim();
  if (words.length === 0) throw new Error("a message with no words says nothing");
  const messageId = options.messageId ?? randomUUID();
  const message: ConversationMessage = {
    version: CONVERSATION_VERSION,
    messageId,
    kind: options.kind,
    to: options.to,
    toKind: options.toKind,
    author: options.author,
    words,
    ...(options.answers !== undefined ? { answers: options.answers } : {}),
    ...(options.stage !== undefined ? { stage: options.stage } : {}),
    ...(options.runId !== undefined ? { runId: options.runId } : {}),
    sentAt: (options.now ?? (() => new Date()))().toISOString(),
    machine: options.machine,
    ...(options.gitAuthor !== undefined ? { gitAuthor: options.gitAuthor } : {}),
  };
  await writeSealed(options.directory, messageId, message, options.key);
  return messageId;
}

/** A payload as a file holds it, or `undefined` for one that is not a
 * well-formed conversation message. */
function readConversationMessage(value: unknown): ConversationMessage | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const message = value as Record<string, unknown>;
  if (message.version !== CONVERSATION_VERSION) return undefined;
  if (message.kind !== "note" && message.kind !== "ask" && message.kind !== "answer") return undefined;
  if (typeof message.messageId !== "string" || typeof message.to !== "string") return undefined;
  if (message.toKind !== "run" && message.toKind !== "person") return undefined;
  if (message.author !== "person" && message.author !== "run") return undefined;
  if (typeof message.words !== "string" || message.words.trim().length === 0) return undefined;
  if (typeof message.sentAt !== "string" || !Number.isFinite(Date.parse(message.sentAt))) return undefined;
  if (typeof message.machine !== "string") return undefined;
  for (const field of ["answers", "stage", "runId", "gitAuthor"] as const) {
    if (message[field] !== undefined && typeof message[field] !== "string") return undefined;
  }
  return {
    version: CONVERSATION_VERSION,
    messageId: message.messageId,
    kind: message.kind,
    to: message.to,
    toKind: message.toKind,
    author: message.author,
    words: message.words,
    ...(typeof message.answers === "string" ? { answers: message.answers } : {}),
    ...(typeof message.stage === "string" ? { stage: message.stage } : {}),
    ...(typeof message.runId === "string" ? { runId: message.runId } : {}),
    sentAt: message.sentAt,
    machine: message.machine,
    ...(typeof message.gitAuthor === "string" ? { gitAuthor: message.gitAuthor } : {}),
  };
}

export interface ReadMessagesOptions {
  directory: string;
  /** Who is reading: a run's instance id, or a person's key id. */
  to: string;
  roster: Roster;
  now: Date;
  /** The message ids this reader has already read. */
  seen: ReadonlySet<string>;
  /** Whether a message written by a run is taken. Absent is `false`: a run
   * that takes instructions from another run has a second operator nobody
   * chose (the-operator-can-say-something-to-a-run). A person's messages
   * are always taken. */
  allowFromRun?: boolean;
}

/** The notes, questions and answers addressed to one reader, each with
 * what the reader does about it.
 *
 * A payload is parsed only once its envelope opens (ADR 0028), and a stop
 * request in the same directory is not one of these: it is read by
 * `readStopRequests` and left alone here. */
export async function readMessagesFor(options: ReadMessagesOptions): Promise<ConversationReading[]> {
  const readings: ConversationReading[] = [];
  for (const fileName of await requestFileNames(options.directory)) {
    let text: string;
    try {
      text = await readFile(path.join(options.directory, fileName), "utf8");
    } catch {
      continue;
    }
    const opened = openEnvelope(text, options.roster);
    if (opened.state === "does-not-check-out") continue;
    let message: ConversationMessage | undefined;
    try {
      message = readConversationMessage(JSON.parse(Buffer.from(opened.bytes).toString("utf8")));
    } catch {
      message = undefined;
    }
    if (message === undefined || message.messageId !== fileName.slice(0, -".json".length)) continue;
    if (message.to !== options.to) continue;

    if (opened.state !== "verified") {
      readings.push({ state: "refused", message, why: "unverified" });
    } else if (options.seen.has(message.messageId)) {
      readings.push({ state: "refused", message, why: "seen" });
    } else if (Math.abs(options.now.getTime() - Date.parse(message.sentAt)) > CONVERSATION_STALE_AFTER_MS) {
      readings.push({ state: "refused", message, why: "stale" });
    } else if (message.author === "run" && options.allowFromRun !== true) {
      readings.push({ state: "refused", message, why: "author-not-allowed" });
    } else {
      readings.push({ state: "act", message, person: opened.person });
    }
  }
  return readings;
}

/** Removes a message that has been delivered or read. Delivery is what
 * ends a conversation message, not the clock. A message that is already
 * gone is not an error: two readers can finish with it at once. */
export async function forgetMessage(directory: string, messageId: string): Promise<void> {
  await rm(path.join(path.resolve(directory), `${messageId}.json`), { force: true });
}

/** Removes what nobody came back for: every file in the directory older
 * than `olderThanMs`, by the time it was written.
 *
 * By file time rather than by what is inside, so a file whose envelope
 * does not check out is swept too. Nothing reads it, and it would
 * otherwise stay for ever. */
export async function sweepOldMessages(
  directory: string,
  options: { now?: Date; olderThanMs?: number } = {},
): Promise<string[]> {
  const now = (options.now ?? new Date()).getTime();
  const olderThanMs = options.olderThanMs ?? CONVERSATION_STALE_AFTER_MS;
  const swept: string[] = [];
  for (const fileName of await requestFileNames(directory)) {
    const full = path.join(path.resolve(directory), fileName);
    try {
      const written = (await stat(full)).mtimeMs;
      if (now - written <= olderThanMs) continue;
      await rm(full, { force: true });
      swept.push(fileName);
    } catch {
      // Gone already, or not readable: nothing to sweep either way.
    }
  }
  return swept;
}

export type StopRequestReading =
  | { state: "act"; message: StopMessage; person: EnrolledPerson }
  | { state: "refused"; message: StopMessage; why: StopRequestRefusal };

export interface AskRunToStopOptions {
  directory: string;
  to: string;
  reason: string;
  /** The task to finish before stopping. Refused here rather than written
   * as something a run would have to refuse later. */
  afterTask?: string;
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
  if (options.afterTask !== undefined && !isTaskNumber(options.afterTask)) {
    throw new Error(`${JSON.stringify(options.afterTask)} is not a task number, such as 4.6`);
  }
  const message: StopMessage = {
    version: STOP_MESSAGE_VERSION,
    messageId,
    kind: "stop",
    to: options.to,
    reason: options.reason,
    ...(options.afterTask !== undefined ? { afterTask: options.afterTask.trim() } : {}),
    sentAt: (options.now ?? (() => new Date()))().toISOString(),
    machine: options.machine,
    ...(options.gitAuthor !== undefined ? { gitAuthor: options.gitAuthor } : {}),
  };
  await writeSealed(options.directory, messageId, message, options.key);
  return messageId;
}

/** Seals a payload and puts it in the directory under its message id,
 * through a temporary name and a rename so nobody reads half a file. */
async function writeSealed(
  directory: string,
  messageId: string,
  message: StopMessage | ConversationMessage,
  key: Pick<MachineKey, "keyId" | "publicKey" | "sign">,
): Promise<void> {
  const bytes = Buffer.from(`${JSON.stringify(message, null, 2)}\n`, "utf8");
  const written = `${JSON.stringify(sealEnvelope(bytes, key), null, 2)}\n`;
  const resolved = path.resolve(directory);
  await mkdir(resolved, { recursive: true });
  const filePath = path.join(resolved, `${messageId}.json`);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, written, "utf8");
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
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
  // A task that is not a task number is not a request anybody can honour:
  // the run would have to guess between "stop now" and "never stop", and
  // both are wrong (a-run-is-told-where-to-stop).
  if (message.afterTask !== undefined && (typeof message.afterTask !== "string" || !isTaskNumber(message.afterTask))) {
    return undefined;
  }
  return {
    version: STOP_MESSAGE_VERSION,
    messageId: message.messageId,
    kind: "stop",
    to: message.to,
    reason: message.reason,
    ...(typeof message.afterTask === "string" ? { afterTask: message.afterTask.trim() } : {}),
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

/** The label this machine's key is enrolled under in the roster beside a
 * status directory, or `undefined` where it is not enrolled or cannot be
 * read. A host passes it to the cards as `myLabel`, so a card offers Stop only
 * on this person's own verified runs (a-run-elsewhere-can-be-asked-to-stop). */
export async function myRosterLabel(
  statusDirectory: string,
  seams: {
    loadKey?: () => Promise<Pick<MachineKey, "keyId">>;
    readRoster?: (rosterDirectory: string) => Promise<Roster>;
  } = {},
): Promise<string | undefined> {
  try {
    const readRoster = seams.readRoster ?? (async (directory: string) => rosterOf((await readAgentRoster(directory)).entries));
    const roster = await readRoster(rosterDirectoryBeside(statusDirectory));
    // Read first: where nobody is enrolled there is no label to find, and no
    // reason to load, or make, this machine's key just to look.
    if (roster.size === 0) return undefined;
    const key = await (seams.loadKey ?? (() => loadOrCreateMachineKey()))();
    return roster.get(key.keyId)?.label;
  } catch {
    // No key, or no roster to read: nobody is enrolled, so no card offers
    // Stop on a run elsewhere.
    return undefined;
  }
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
