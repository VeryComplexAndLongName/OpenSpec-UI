// Who a key belongs to — ADR 0028, "Enrolment is one confirmation".
//
// One file per enrolled key, beside the status directory: one writer per
// fact, and no lock. A file whose name or key does not agree with its key id
// is reported and never trusted. The directory's permissions are the trust
// boundary ADR 0028 names for today.

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentStatusReport } from "./agent-status.js";
import type { EnrolmentRequest } from "./signature-facts.js";
import { keyMatchesKeyId, type Roster, type RosterKey } from "./signed-envelope.js";

/** One enrolled key. */
export interface AgentRosterEntry extends RosterKey {
  /** The machine the key's record named when it was enrolled. */
  machine: string;
  confirmedAt: string;
}

export interface AgentRosterMalformed {
  fileName: string;
  reason: string;
}

export interface AgentRosterReading {
  entries: AgentRosterEntry[];
  malformed: AgentRosterMalformed[];
}

const KEY_ID_PATTERN = /^[0-9a-f]{32}$/u;

/** Where a repository's roster lives: beside `agentStatusDirectory`, in
 * ADR 0027's container for the repository's working directories. */
export function agentRosterDirectory(worktreeRoot: string, repositoryRoot: string): string {
  return path.join(path.resolve(worktreeRoot), path.basename(path.resolve(repositoryRoot)), ".agent-roster");
}

/** The roster beside a status directory. */
export function rosterDirectoryBeside(statusDirectory: string): string {
  return path.join(path.dirname(path.resolve(statusDirectory)), ".agent-roster");
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
}

/** An entry as a file holds it, or why it is not trusted. */
function readEntry(fileName: string, text: string): AgentRosterEntry | string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return "not valid JSON";
  }
  if (typeof value !== "object" || value === null) return "not an entry";
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.keyId !== "string" ||
    typeof entry.publicKey !== "string" ||
    typeof entry.label !== "string" ||
    entry.label.trim().length === 0 ||
    typeof entry.machine !== "string" ||
    typeof entry.confirmedAt !== "string" ||
    (entry.gitAuthor !== undefined && typeof entry.gitAuthor !== "string")
  ) {
    return "missing or invalid required fields";
  }
  if (fileName !== `${entry.keyId}.json`) return `its file name does not match its key id "${entry.keyId}"`;
  if (!KEY_ID_PATTERN.test(entry.keyId) || !keyMatchesKeyId(entry.publicKey, entry.keyId)) {
    return "its key does not match its key id";
  }
  return {
    keyId: entry.keyId,
    publicKey: entry.publicKey,
    label: entry.label,
    machine: entry.machine,
    confirmedAt: entry.confirmedAt,
    ...(typeof entry.gitAuthor === "string" ? { gitAuthor: entry.gitAuthor } : {}),
  };
}

/** Every enrolled key in `directory`, and every file that is not trusted. A
 * directory that does not exist is an empty roster. */
export async function readAgentRoster(directory: string): Promise<AgentRosterReading> {
  const reading: AgentRosterReading = { entries: [], malformed: [] };
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return reading;
    throw error;
  }
  for (const fileName of names.sort()) {
    if (!fileName.endsWith(".json")) continue;
    let text: string;
    try {
      text = await readFile(path.join(directory, fileName), "utf8");
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      reading.malformed.push({ fileName, reason: error instanceof Error ? error.message : String(error) });
      continue;
    }
    const entry = readEntry(fileName, text);
    if (typeof entry === "string") reading.malformed.push({ fileName, reason: entry });
    else reading.entries.push(entry);
  }
  return reading;
}

/** The trusted entries, by key id. */
export function rosterOf(entries: readonly AgentRosterEntry[]): Roster {
  return new Map(entries.map((entry) => [entry.keyId, entry]));
}

/** One request for each key that signs a live, unverified record and is not
 * in the roster, from its most recent record. */
export function collectEnrolmentRequests(input: {
  statuses: readonly AgentStatusReport[];
  roster: Roster;
}): EnrolmentRequest[] {
  const latest = new Map<string, AgentStatusReport>();
  for (const report of input.statuses) {
    if (report.gone || report.signature !== "unverified" || report.signer === undefined) continue;
    if (input.roster.has(report.signer.keyId)) continue;
    const seen = latest.get(report.signer.keyId);
    if (seen === undefined || Date.parse(report.heartbeatAt) > Date.parse(seen.heartbeatAt)) {
      latest.set(report.signer.keyId, report);
    }
  }
  return [...latest.values()]
    .map((report) => ({
      keyId: (report.signer as { keyId: string }).keyId,
      publicKey: (report.signer as { publicKey: string }).publicKey,
      label: path.basename(report.workingDirectory),
      workingDirectory: report.workingDirectory,
      machine: report.machine,
      gitAuthor: report.gitAuthor,
      seenAt: report.heartbeatAt,
    }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.keyId.localeCompare(right.keyId));
}

/** A confirmation that would enrol something other than the key it names. */
export class EnrolmentRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnrolmentRefusedError";
  }
}

export interface ConfirmEnrolmentOptions {
  rosterDirectory: string;
  request: Pick<EnrolmentRequest, "keyId" | "publicKey" | "label" | "machine" | "gitAuthor">;
  /** The name the person is to be known by. Defaults to the git author, then
   * the directory's label. */
  label?: string;
  /** Test seam. */
  now?: () => Date;
}

/** Enrols a request's key, once. A key already enrolled with the same public
 * key is returned as it is; one enrolled under that id with a different key,
 * or a request whose key does not match its id, is refused. */
export async function confirmEnrolment(options: ConfirmEnrolmentOptions): Promise<AgentRosterEntry> {
  const { request } = options;
  if (!KEY_ID_PATTERN.test(request.keyId) || !keyMatchesKeyId(request.publicKey, request.keyId)) {
    throw new EnrolmentRefusedError(`the key offered for ${request.keyId} does not match that key id`);
  }
  const directory = path.resolve(options.rosterDirectory);
  const fileName = `${request.keyId}.json`;
  const target = path.join(directory, fileName);

  const existing = await readFile(target, "utf8").catch((error: unknown) => {
    if (errorCode(error) === "ENOENT") return undefined;
    throw error;
  });
  if (existing !== undefined) {
    const entry = readEntry(fileName, existing);
    if (typeof entry === "string" || entry.publicKey !== request.publicKey) {
      throw new EnrolmentRefusedError(`${request.keyId} is already enrolled with a different key`);
    }
    return entry;
  }

  const label = [options.label, request.gitAuthor, request.label]
    .map((candidate) => candidate?.trim())
    .find((candidate): candidate is string => candidate !== undefined && candidate.length > 0) ?? request.keyId;
  const entry: AgentRosterEntry = {
    keyId: request.keyId,
    publicKey: request.publicKey,
    label,
    ...(request.gitAuthor ? { gitAuthor: request.gitAuthor } : {}),
    machine: request.machine ?? "a machine its record did not name",
    confirmedAt: (options.now ?? (() => new Date()))().toISOString(),
  };
  await mkdir(directory, { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
  return entry;
}
