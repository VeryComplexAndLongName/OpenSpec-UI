// The people of a repository, in git (ADR 0037, a-team-works-through-git).
//
// One file per person, `openspec/people/<handle>.json`, with a public key
// for each machine they sign on. The roster beside the repository
// (ADR 0028) is one machine's; this is every machine's and every
// colleague's, because it is committed. Joining is a pull request that adds
// the file, and a new machine is one that adds its key.
//
// A key is never taken out, only retired: a history signed with it has to
// verify for as long as the history is kept, which is for good.

import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { GitWrapper } from "./git.js";
import { loadOrCreateMachineKey, type MachineKey } from "./machine-key.js";
import { keyMatchesKeyId, type Roster, type RosterKey } from "./signed-envelope.js";

/** Where the people of a repository are, relative to its root. */
export const PEOPLE_DIRECTORY = "openspec/people";

/** A handle: lower-case letters, digits and single hyphens, starting with a
 * letter or a digit, at most 39 characters - the shape a forge accepts for
 * a user name, so nobody has to invent a second one. */
export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/u;

export interface PersonKey {
  keyId: string;
  /** Base64 of the key's SPKI DER encoding, as an envelope carries it. */
  publicKey: string;
  /** The machine the key was made on, as the person named it. */
  machine?: string;
  /** When the key was added, as an ISO date or date-time. */
  addedAt: string;
  /** When the key stopped being used: a lost or retired machine. Its old
   * signatures still verify; nothing new should be signed with it. */
  retiredAt?: string;
}

export interface Person {
  handle: string;
  name: string;
  keys: PersonKey[];
  /** The git e-mail addresses that are this person's. Optional, so a
   * public repository need not publish one. */
  emails?: string[];
}

export interface PeopleProblem {
  /** The file the problem is in, relative to the repository root. */
  file: string;
  problem: string;
}

export interface PeopleReading {
  people: Person[];
  problems: PeopleProblem[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One person's file, read and checked. The file name has to be the handle:
 * two files cannot then claim one handle. */
export function parsePersonFile(fileName: string, text: string): { person: Person } | { problems: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { problems: ["it is not valid JSON"] };
  }
  if (!isRecord(parsed)) return { problems: ["it is not a JSON object"] };

  const problems: string[] = [];
  const handle = parsed.handle;
  if (typeof handle !== "string" || !HANDLE_PATTERN.test(handle)) {
    problems.push("its handle is missing or not lower-case letters, digits and single hyphens");
  } else if (fileName !== `${handle}.json`) {
    problems.push(`its file is not named after its handle (${handle}.json)`);
  }
  const name = parsed.name;
  if (typeof name !== "string" || name.trim().length === 0) problems.push("it has no name");

  const keys: PersonKey[] = [];
  if (!Array.isArray(parsed.keys) || parsed.keys.length === 0) {
    problems.push("it lists no key");
  } else {
    parsed.keys.forEach((entry, index) => {
      const at = `key ${index + 1}`;
      if (!isRecord(entry)) {
        problems.push(`${at} is not a JSON object`);
        return;
      }
      if (!keyMatchesKeyId(entry.publicKey, entry.keyId)) {
        problems.push(`${at} is not an Ed25519 public key with its key id`);
        return;
      }
      if (typeof entry.addedAt !== "string" || !ISO_DATE.test(entry.addedAt)) {
        problems.push(`${at} has no date it was added`);
        return;
      }
      if (entry.retiredAt !== undefined && (typeof entry.retiredAt !== "string" || !ISO_DATE.test(entry.retiredAt))) {
        problems.push(`${at} has a retirement date that is not a date`);
        return;
      }
      if (entry.machine !== undefined && typeof entry.machine !== "string") {
        problems.push(`${at} names its machine with something other than text`);
        return;
      }
      keys.push({
        keyId: entry.keyId as string,
        publicKey: entry.publicKey as string,
        addedAt: entry.addedAt,
        ...(typeof entry.machine === "string" ? { machine: entry.machine } : {}),
        ...(typeof entry.retiredAt === "string" ? { retiredAt: entry.retiredAt } : {}),
      });
    });
  }

  let emails: string[] | undefined;
  if (parsed.emails !== undefined) {
    if (!Array.isArray(parsed.emails) || parsed.emails.some((email) => typeof email !== "string" || !email.includes("@"))) {
      problems.push("its e-mail addresses are not a list of addresses");
    } else {
      emails = parsed.emails as string[];
    }
  }

  if (problems.length > 0) return { problems };
  return { person: { handle: handle as string, name: (name as string).trim(), keys, ...(emails !== undefined ? { emails } : {}) } };
}

/** What is wrong across the people of a repository, beyond each file on its
 * own: one key in two people's files would let either sign as the other. */
export function crossCheckPeople(people: readonly Person[]): PeopleProblem[] {
  const problems: PeopleProblem[] = [];
  const owner = new Map<string, string>();
  for (const person of people) {
    for (const key of person.keys) {
      const first = owner.get(key.keyId);
      if (first !== undefined && first !== person.handle) {
        problems.push({ file: `${PEOPLE_DIRECTORY}/${person.handle}.json`, problem: `key ${key.keyId} is also ${first}'s` });
      } else {
        owner.set(key.keyId, person.handle);
      }
    }
  }
  return problems;
}

function readingOf(files: Array<{ name: string; text: string }>): PeopleReading {
  const people: Person[] = [];
  const problems: PeopleProblem[] = [];
  for (const file of files.sort((left, right) => left.name.localeCompare(right.name))) {
    const read = parsePersonFile(file.name, file.text);
    const relative = `${PEOPLE_DIRECTORY}/${file.name}`;
    if ("problems" in read) {
      for (const problem of read.problems) problems.push({ file: relative, problem });
    } else {
      people.push(read.person);
    }
  }
  return { people, problems: [...problems, ...crossCheckPeople(people)] };
}

/** The people in a working tree. No directory is no people, not a fault. */
export async function readPeople(root: string): Promise<PeopleReading> {
  const directory = path.join(root, PEOPLE_DIRECTORY);
  let names: string[];
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith(".json"));
  } catch {
    return { people: [], problems: [] };
  }
  const files = await Promise.all(names.map(async (name) => ({ name, text: await readFile(path.join(directory, name), "utf8") })));
  return readingOf(files);
}

/** The people at a ref, for comparing a pull request with what it merges
 * into. */
export async function readPeopleAt(git: Pick<GitWrapper, "listTreeNames" | "showFile">, ref: string): Promise<PeopleReading> {
  const names = (await git.listTreeNames(ref, PEOPLE_DIRECTORY)).filter((name) => name.endsWith(".json"));
  const files: Array<{ name: string; text: string }> = [];
  for (const name of names) {
    const text = await git.showFile(ref, `${PEOPLE_DIRECTORY}/${name}`);
    if (text !== undefined) files.push({ name, text });
  }
  return readingOf(files);
}

/** The people's keys as a roster, for `openEnvelope`: a signature by any of
 * them verifies, and names the person by their name and handle. Retired
 * keys are in it, since what they signed before still counts. */
export function peopleRoster(people: readonly Person[]): Roster {
  const roster = new Map<string, RosterKey>();
  for (const person of people) {
    for (const key of person.keys) {
      roster.set(key.keyId, { keyId: key.keyId, publicKey: key.publicKey, label: person.name, handle: person.handle });
    }
  }
  return roster;
}

/** What a pull request may not do to the people it merges into: take a
 * person out, take a key out, or change a key or a retirement already
 * recorded. Every one of these would leave a signature that verified
 * yesterday unverifiable today. Adding people, keys, e-mail addresses and
 * retirement dates is always allowed. */
export function comparePeople(base: readonly Person[], head: readonly Person[]): PeopleProblem[] {
  const problems: PeopleProblem[] = [];
  const byHandle = new Map(head.map((person) => [person.handle, person]));
  for (const before of base) {
    const file = `${PEOPLE_DIRECTORY}/${before.handle}.json`;
    const after = byHandle.get(before.handle);
    if (after === undefined) {
      problems.push({ file, problem: "a person is never removed: their signatures would stop verifying" });
      continue;
    }
    const keys = new Map(after.keys.map((key) => [key.keyId, key]));
    for (const key of before.keys) {
      const now = keys.get(key.keyId);
      if (now === undefined) {
        problems.push({ file, problem: `key ${key.keyId} was removed; retire it with retiredAt instead` });
      } else if (now.publicKey !== key.publicKey) {
        problems.push({ file, problem: `key ${key.keyId} was replaced` });
      } else if (key.retiredAt !== undefined && now.retiredAt !== key.retiredAt) {
        problems.push({ file, problem: `key ${key.keyId}'s retirement was changed` });
      }
    }
  }
  return problems;
}

/** The person this machine's key belongs to, where it is in somebody's
 * file. Loads the key, making it if the machine has none yet. */
export async function personOfThisMachine(root: string, options: { key?: Pick<MachineKey, "keyId"> } = {}): Promise<Person | undefined> {
  const key = options.key ?? await loadOrCreateMachineKey();
  return (await readPeople(root)).people.find((person) => person.keys.some((one) => one.keyId === key.keyId));
}

export class JoinRefusedError extends Error {}

export interface JoinOptions {
  handle: string;
  name: string;
  email?: string;
  /** Test seams. */
  key?: Pick<MachineKey, "keyId" | "publicKey">;
  machine?: string;
  now?: () => Date;
}

export interface JoinResult {
  /** The file written, relative to the repository root. */
  file: string;
  person: Person;
  /** What changed: a new person, this machine's key added to a person
   * already there, or nothing, where both were there. */
  outcome: "joined" | "key-added" | "already";
}

/** Writes this person's file with this machine's key, or adds the key to
 * the file they already have. Nothing is committed: joining is the pull
 * request that carries the file, reviewed like any other. */
export async function joinTheTeam(root: string, options: JoinOptions): Promise<JoinResult> {
  if (!HANDLE_PATTERN.test(options.handle)) {
    throw new JoinRefusedError(`"${options.handle}" is not a handle: use lower-case letters, digits and single hyphens`);
  }
  if (options.name.trim().length === 0) throw new JoinRefusedError("a name is needed");
  const key = options.key ?? await loadOrCreateMachineKey();
  const reading = await readPeople(root);
  const holder = reading.people.find((person) => person.keys.some((one) => one.keyId === key.keyId));
  if (holder !== undefined && holder.handle !== options.handle) {
    throw new JoinRefusedError(`this machine's key is already ${holder.handle}'s`);
  }

  const relative = `${PEOPLE_DIRECTORY}/${options.handle}.json`;
  const file = path.join(root, PEOPLE_DIRECTORY, `${options.handle}.json`);
  const existingText = await readFile(file, "utf8").catch(() => undefined);
  let person: Person;
  let outcome: JoinResult["outcome"];
  if (existingText !== undefined) {
    const read = parsePersonFile(`${options.handle}.json`, existingText);
    if ("problems" in read) throw new JoinRefusedError(`${relative} cannot be read: ${read.problems.join("; ")}`);
    person = read.person;
    if (person.keys.some((one) => one.keyId === key.keyId)) {
      return { file: relative, person, outcome: "already" };
    }
    outcome = "key-added";
  } else {
    person = { handle: options.handle, name: options.name.trim(), keys: [] };
    outcome = "joined";
  }

  const addedAt = (options.now ?? (() => new Date()))().toISOString().slice(0, 10);
  const machine = options.machine ?? os.hostname();
  person = {
    ...person,
    keys: [...person.keys, { keyId: key.keyId, publicKey: key.publicKey, ...(machine.length > 0 ? { machine } : {}), addedAt }],
  };
  if (options.email !== undefined && options.email.length > 0 && !(person.emails ?? []).includes(options.email)) {
    person = { ...person, emails: [...(person.emails ?? []), options.email] };
  }

  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(person, null, 2)}\n`, "utf8");
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
  return { file: relative, person, outcome };
}
