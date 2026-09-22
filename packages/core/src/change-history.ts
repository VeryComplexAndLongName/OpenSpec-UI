// A change's history, in git: one signed file per event, only ever added to
// (ADR 0037 decisions 3 and 4, a-change-keeps-its-history).
//
// An event is a signed envelope (`signed-envelope.ts`, unchanged) whose
// payload says what happened, when, who signed it, and whether a person or
// their agent acted. The files live in `openspec/changes/<id>/history/`,
// and one file per event means two branches never edit the same file.
// Who holds a change now is played forward from them; nothing else
// records it.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  playHistory,
  type ChangeRoles,
  type HistoryActor,
  type HistoryEntry,
  type HistoryEvent,
  type HistoryProblem,
  type ReopenedTask,
  type SendBackStage,
  parseHistoryEvent,
} from "./change-history-facts.js";
import type { GitWrapper } from "./git.js";
import { loadOrCreateMachineKey, type MachineKey } from "./machine-key.js";
import { peopleRoster, readPeople, type Person } from "./people.js";
import { openEnvelope, sealEnvelope, type Roster } from "./signed-envelope.js";
import { parseTaskChecklist, taskNumberOf } from "./task-checklist.js";

const CHANGES = "openspec/changes";
export const HISTORY_DIRECTORY = "history";

/** A change's name as a directory may carry it: nothing that could leave
 * `openspec/changes/`. */
const CHANGE_NAME = /^[a-z0-9][a-z0-9-]*$/u;

/** Where a change's history is, relative to the repository root. */
export function historyPathOf(changeName: string): string {
  return `${CHANGES}/${changeName}/${HISTORY_DIRECTORY}`;
}

/** One history file's text, read: its signature against the people, and
 * its event where it has one. */
export function readHistoryFile(file: string, text: string, roster: Roster): HistoryEntry {
  const opened = openEnvelope(text, roster);
  if (opened.state === "does-not-check-out") return { file, signature: "does-not-check-out", unreadable: opened.why };
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(opened.bytes).toString("utf8"));
  } catch {
    return { file, signature: opened.state, keyId: opened.signer.keyId, unreadable: "its payload is not JSON" };
  }
  const read = parseHistoryEvent(parsed);
  const handle = opened.state === "verified" ? opened.person.handle : undefined;
  return {
    file,
    signature: opened.state,
    keyId: opened.signer.keyId,
    ...(handle !== undefined ? { handle } : {}),
    ...("event" in read ? { event: read.event } : { unreadable: read.problem }),
  };
}

export interface ChangeHistory {
  changeName: string;
  entries: HistoryEntry[];
  roles: ChangeRoles;
  problems: HistoryProblem[];
}

function teamOf(people: readonly Person[]): Set<string> {
  return new Set(people.map((person) => person.handle));
}

async function historyTexts(directory: string): Promise<Array<{ file: string; text: string }>> {
  let names: string[];
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return Promise.all(names.map(async (file) => ({ file, text: await readFile(path.join(directory, file), "utf8") })));
}

/** A change's history in a working tree, read against its people. A change
 * with no history has none, and no roles. */
export async function readChangeHistory(root: string, changeName: string, options: { people?: readonly Person[]; archiveName?: string } = {}): Promise<ChangeHistory> {
  const people = options.people ?? (await readPeople(root)).people;
  const roster = peopleRoster(people);
  const where = options.archiveName === undefined ? path.join(root, CHANGES, changeName, HISTORY_DIRECTORY) : path.join(root, CHANGES, "archive", options.archiveName, HISTORY_DIRECTORY);
  const entries = (await historyTexts(where)).map(({ file, text }) => readHistoryFile(file, text, roster));
  const played = playHistory(changeName, entries, teamOf(people));
  return { changeName, entries, ...played };
}

export class HistoryRefusedError extends Error {}

/** Who is acting, where nobody said: an agent that the environment names,
 * or the person. `OPENSPEC_UI_AGENT` is ours; `AI_AGENT` is set by agents
 * such as Claude Code (`claude-code_<version>_agent`), and `CLAUDECODE` by
 * Claude Code alone. So an agent's event reads as an agent's without the
 * agent having to say so. */
export function actorFromEnvironment(env: NodeJS.ProcessEnv = process.env): HistoryActor {
  const runId = env.OPENSPEC_UI_RUN_ID;
  const named = env.OPENSPEC_UI_AGENT ?? env.AI_AGENT?.split("_")[0] ?? (env.CLAUDECODE === "1" ? "claude-code" : undefined);
  if (named === undefined || named.length === 0) return { kind: "person" };
  return { kind: "agent", agent: named, ...(runId !== undefined && runId.length > 0 ? { runId } : {}) };
}

export type HistoryRequest =
  | { type: "owner-set"; to: string }
  | { type: "implementer-set"; to: string | null }
  | { type: "sent-back"; toStage: SendBackStage; reason: string; reopened?: ReopenedTask[] };

export interface RecordOptions {
  /** Who acted. Defaults to what the environment says. */
  actor?: HistoryActor;
  /** Test seams. */
  key?: Pick<MachineKey, "keyId" | "publicKey" | "sign">;
  now?: () => Date;
}

export interface RecordedEvent {
  /** The file written, relative to the repository root. */
  file: string;
  event: HistoryEvent;
  roles: ChangeRoles;
  /** The task list, where sending back reopened items in it. */
  tasksFile?: string;
}

function compactTime(at: string): string {
  return at.replace(/[-:]/gu, "").replace(/\.\d+/u, "");
}

/** Reopens the named closed items in a `tasks.md` text, each with a line
 * under it saying when, by whom and why. Refuses an item the list does not
 * have, or one that is not closed. */
export function reopenTasks(content: string, reopened: readonly ReopenedTask[], by: string, date: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/u);
  const items = parseTaskChecklist(content);
  // From the bottom up, so inserting a line leaves the numbers above it.
  const targets = reopened.map((one) => {
    const item = items.find((candidate) => taskNumberOf(candidate.text) === one.task);
    if (item === undefined) throw new HistoryRefusedError(`tasks.md has no item ${one.task}`);
    if (!item.done) throw new HistoryRefusedError(`item ${one.task} is not closed, so it cannot be reopened`);
    return { item, why: one.why };
  }).sort((left, right) => right.item.lineNumber - left.item.lineNumber);
  for (const { item, why } of targets) {
    lines[item.lineNumber] = (lines[item.lineNumber] as string).replace(/^([ \t]*-\s\[)[xX](\])/u, "$1 $2");
    let after = item.lineNumber + 1;
    while (after < lines.length && /^[ \t]+(?![-*+][ \t])\S/u.test(lines[after] as string)) after += 1;
    const indent = `${/^([ \t]*)/u.exec(lines[item.lineNumber] as string)?.[1] ?? ""}  `;
    lines.splice(after, 0, `${indent}Reopened on ${date} by ${by}: ${why.trim()}`);
  }
  return lines.join(eol);
}

/** Records one event in a change's history, signed with this machine's
 * key, after checking it against the rules with everything already there.
 * Sending back also reopens the named items in `tasks.md`, each with its
 * reason. Nothing is committed: the event lands with the pull request that
 * carries it. */
export async function recordHistoryEvent(root: string, changeName: string, request: HistoryRequest, options: RecordOptions = {}): Promise<RecordedEvent> {
  if (!CHANGE_NAME.test(changeName)) throw new HistoryRefusedError(`"${changeName}" is not a change name`);
  const changeDirectory = path.join(root, CHANGES, changeName);
  const proposal = await readFile(path.join(changeDirectory, "proposal.md"), "utf8").catch(() => undefined);
  if (proposal === undefined) throw new HistoryRefusedError(`${CHANGES}/${changeName} is not an active change`);

  const key = options.key ?? await loadOrCreateMachineKey();
  const { people } = await readPeople(root);
  const signer = people.find((person) => person.keys.some((one) => one.keyId === key.keyId));
  if (signer === undefined) throw new HistoryRefusedError("this machine's key is in nobody's file in openspec/people: join the team first");
  if (signer.keys.find((one) => one.keyId === key.keyId)?.retiredAt !== undefined) {
    throw new HistoryRefusedError("this machine's key is retired, and nothing new is signed with it");
  }

  const at = (options.now ?? (() => new Date()))().toISOString();
  const base = {
    version: 1 as const,
    change: changeName,
    at,
    by: { handle: signer.handle, keyId: key.keyId },
    actor: options.actor ?? actorFromEnvironment(),
  };
  let event: HistoryEvent;
  if (request.type === "sent-back") {
    if (request.reason.trim().length === 0) throw new HistoryRefusedError("a change is sent back with a reason");
    event = { ...base, type: "sent-back", toStage: request.toStage, reason: request.reason.trim(), reopened: request.reopened ?? [] };
  } else if (request.type === "owner-set") {
    event = { ...base, type: "owner-set", to: request.to };
  } else {
    event = { ...base, type: "implementer-set", to: request.to };
  }

  const directory = path.join(changeDirectory, HISTORY_DIRECTORY);
  const existing = await readChangeHistory(root, changeName, { people });
  let file = `${compactTime(at)}-${key.keyId.slice(0, 8)}-${event.type}.json`;
  for (let count = 2; existing.entries.some((one) => one.file === file); count += 1) {
    file = `${compactTime(at)}-${key.keyId.slice(0, 8)}-${event.type}-${count}.json`;
  }
  const bytes = new TextEncoder().encode(`${JSON.stringify(event, null, 2)}\n`);
  const text = `${JSON.stringify(sealEnvelope(bytes, key), null, 2)}\n`;
  const entry = readHistoryFile(file, text, peopleRoster(people));
  const played = playHistory(changeName, [...existing.entries, entry], new Set(people.map((person) => person.handle)));
  const own = played.problems.find((problem) => problem.file === file);
  if (own !== undefined) throw new HistoryRefusedError(own.problem);

  let tasksFile: string | undefined;
  let tasksBefore: string | undefined;
  if (event.type === "sent-back" && event.reopened.length > 0) {
    const tasksPath = path.join(changeDirectory, "tasks.md");
    tasksBefore = await readFile(tasksPath, "utf8").catch(() => undefined);
    if (tasksBefore === undefined) throw new HistoryRefusedError(`${changeName} has no tasks.md to reopen items in`);
    await writeFile(tasksPath, reopenTasks(tasksBefore, event.reopened, signer.handle, at.slice(0, 10)), "utf8");
    tasksFile = `${CHANGES}/${changeName}/tasks.md`;
  }
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, file), text, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    // An event that could not be written leaves the task list as it was.
    if (tasksBefore !== undefined) await writeFile(path.join(changeDirectory, "tasks.md"), tasksBefore, "utf8").catch(() => undefined);
    throw error;
  }
  return { file: `${historyPathOf(changeName)}/${file}`, event, roles: played.roles, ...(tasksFile !== undefined ? { tasksFile } : {}) };
}

/** Where a history file of a change is, relative to the repository root:
 * under the change, or under its archived directory, which the archive
 * names `<date>-<change>`. */
function historyFilesOf(paths: readonly string[]): Map<string, { change: string; file: string; archiveName?: string }> {
  const found = new Map<string, { change: string; file: string; archiveName?: string }>();
  for (const one of paths) {
    const active = /^openspec\/changes\/([^/]+)\/history\/([^/]+\.json)$/u.exec(one);
    if (active !== null && active[1] !== "archive") {
      found.set(one, { change: active[1] as string, file: active[2] as string });
      continue;
    }
    const archived = /^openspec\/changes\/archive\/(\d{4}-\d{2}-\d{2}-(.+))\/history\/([^/]+\.json)$/u.exec(one);
    if (archived !== null) found.set(one, { change: archived[2] as string, file: archived[3] as string, archiveName: archived[1] as string });
  }
  return found;
}

async function workingTreeHistoryPaths(root: string): Promise<string[]> {
  const paths: string[] = [];
  const list = async (relative: string) => (await readdir(path.join(root, relative)).catch(() => [] as string[]));
  for (const name of await list(CHANGES)) {
    if (name === "archive") {
      for (const archived of await list(`${CHANGES}/archive`)) {
        for (const file of await list(`${CHANGES}/archive/${archived}/${HISTORY_DIRECTORY}`)) paths.push(`${CHANGES}/archive/${archived}/${HISTORY_DIRECTORY}/${file}`);
      }
      continue;
    }
    for (const file of await list(`${CHANGES}/${name}/${HISTORY_DIRECTORY}`)) paths.push(`${CHANGES}/${name}/${HISTORY_DIRECTORY}/${file}`);
  }
  return paths.filter((one) => one.endsWith(".json"));
}

/** What a pull request did to the histories it merges into, and what is
 * wrong with what it added (ADR 0037 decision 4):
 * - a history file on the base has to be on the head, unchanged, under the
 *   change or under its archive;
 * - every file the head adds has to check out, be signed by someone on the
 *   team, and keep the rules when played with everything before it.
 *
 * A file already on the base is not judged again: the base is what was
 * accepted. Without a base, every file is judged. */
export async function checkHistories(root: string, people: readonly Person[], base?: { git: Pick<GitWrapper, "listFilesUnder" | "showFile">; ref: string }): Promise<HistoryProblem[]> {
  const problems: HistoryProblem[] = [];
  const headPaths = await workingTreeHistoryPaths(root);
  const head = historyFilesOf(headPaths);
  const headText = new Map<string, string>();
  for (const one of head.keys()) headText.set(one, await readFile(path.join(root, one), "utf8"));

  const onBase = new Set<string>();
  if (base !== undefined) {
    const basePaths = (await base.git.listFilesUnder(base.ref, CHANGES)).filter((one) => one.includes(`/${HISTORY_DIRECTORY}/`));
    for (const [basePath, where] of historyFilesOf(basePaths)) {
      const text = await base.git.showFile(base.ref, basePath);
      // The same file under the change, or under its archive, unchanged.
      const candidates = [...head.entries()].filter(([, other]) => other.change === where.change && other.file === where.file);
      const kept = candidates.find(([headPath]) => headText.get(headPath) === text);
      if (kept === undefined) {
        problems.push({
          file: basePath,
          problem: candidates.length === 0 ? "a history file was deleted; history is only ever added to" : "a history file was changed; history is only ever added to",
        });
        continue;
      }
      onBase.add(kept[0]);
    }
  }

  const roster = peopleRoster(people);
  const team = new Set(people.map((person) => person.handle));
  const byChange = new Map<string, Array<{ headPath: string; entry: HistoryEntry }>>();
  for (const [headPath, where] of head) {
    const key = `${where.archiveName ?? ""}/${where.change}`;
    const list = byChange.get(key) ?? [];
    list.push({ headPath, entry: readHistoryFile(where.file, headText.get(headPath) as string, roster) });
    byChange.set(key, list);
  }
  for (const [key, list] of byChange) {
    const change = key.slice(key.indexOf("/") + 1);
    const played = playHistory(change, list.map((one) => one.entry), team);
    for (const problem of played.problems) {
      const at = list.find((one) => one.entry.file === problem.file);
      if (at === undefined || onBase.has(at.headPath)) continue;
      problems.push({ file: at.headPath, problem: problem.problem });
    }
  }
  return problems;
}
