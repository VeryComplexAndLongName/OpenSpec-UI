// What each agent run said, kept after it ends (a-change-shows-its-run-logs).
//
// Before this, a run's output lived only on the socket or in the panel that
// started it: once the run ended or the host restarted, all that was left
// was one summary line in the audit log. Every run now writes a log of its
// own, `.openspec-ui/runs/<runId>.jsonl`, one JSON record a line:
//
// - `start`, once per stage (a chain's stages share one run id, and each
//   opens its own part of the file);
// - `line`, what the run said, read the way every surface reads it: a
//   stream's text, an agent's reply or reasoning, a tool call as the line
//   core makes of it, a stage, a stop;
// - `end`, how that part ended.
//
// A log is capped in size and the directory in count. Writing one never
// fails a run: a log that cannot be written is a log that is missing.

import { appendFile, mkdir, open, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { readAcpStreamedText } from "./acp-streamed-text.js";
import { describeAcpUpdate } from "./acp-update-line.js";
import type { Event } from "./protocol.js";
import type { RunLogEnd, RunLogLine, RunLogRecord, RunLogStart, RunLogStream, RunLogSummary } from "./run-log-facts.js";

export type { RunLogEnd, RunLogLine, RunLogOutcome, RunLogRecord, RunLogStart, RunLogStream, RunLogSummary } from "./run-log-facts.js";

export const RUN_LOG_DIRECTORY = path.join(".openspec-ui", "runs");
/** The most one run's log grows to. What comes after is dropped, and the
 * log says where it stopped. */
export const RUN_LOG_MAX_BYTES = 5 * 1024 * 1024;
/** How many runs' logs are kept; the oldest go first. */
export const RUN_LOG_KEEP = 200;

const NL = String.fromCharCode(10);
/** A run id that names a file and nothing else: no separator, no dot
 * segment. Run ids are UUIDs or names made the same way. */
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const FLUSH_BYTES = 64 * 1024;
const FLUSH_MS = 500;

export interface RunLogWriter {
  /** Notes one event of the run. Events that say nothing are skipped. */
  event(event: Event): void;
  /** Writes how this part of the run ended, and everything still held. */
  end(end: Omit<RunLogEnd, "type" | "at">): Promise<void>;
}

export interface RunLogs {
  open(start: Omit<RunLogStart, "type" | "at">): RunLogWriter;
}

export function isRunLogId(runId: string): boolean {
  return RUN_ID.test(runId) && !runId.includes("..");
}

export function runLogPath(workspaceRoot: string, runId: string): string {
  if (!isRunLogId(runId)) throw new Error(`not a run id: ${JSON.stringify(runId)}`);
  return path.join(workspaceRoot, RUN_LOG_DIRECTORY, `${runId}.jsonl`);
}

/** What one event says, as a log line, or nothing. The same reading every
 * surface makes: streamed text as the text, a tool call or a plan as the
 * line core makes of it, and the kinds that carry nothing a person reads
 * left out. */
export function runLogLineOf(event: Event): { stream: RunLogStream; text: string } | undefined {
  switch (event.kind) {
    case "stdout":
      return { stream: "stdout", text: event.chunk };
    case "stderr":
      return { stream: "stderr", text: event.chunk };
    case "progress":
      return { stream: "progress", text: event.message };
    case "agentUpdate": {
      const streamed = readAcpStreamedText(event.update);
      if (streamed) return { stream: streamed.kind === "agent_thought_chunk" ? "reasoning" : "reply", text: streamed.text };
      const line = describeAcpUpdate(event.update);
      return line === undefined ? undefined : { stream: "tool", text: line };
    }
    case "stageStarted":
      return { stream: "stage", text: `stage ${event.stage} started${event.agentId ? ` (${event.agentId})` : ""}` };
    case "stageCompleted":
      return { stream: "stage", text: `stage ${event.stage} completed; next ${event.nextStage}` };
    case "checkpoint":
      return { stream: "stage", text: `checkpoint after ${event.stage}; next ${event.nextStage}` };
    case "permissionRequest":
      return { stream: "permission", text: event.description };
    case "stopRequested":
      return {
        stream: "stop",
        text: event.outcome === "nothing-to-stop"
          ? `asked to stop, with nothing running: ${event.reason}`
          : `asked to stop${event.by ? ` by ${event.by}` : ""}: ${event.reason}`,
      };
    case "usageReported":
      return undefined;
    default:
      return undefined;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Keeps the newest `keep` logs in the directory, the one being written
 * counted among them, and removes the rest. */
async function prune(directory: string, keep: number, current: string): Promise<void> {
  const others = (await readdir(directory))
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => path.join(directory, name))
    .filter((file) => file !== current);
  const room = Math.max(0, keep - 1);
  if (others.length <= room) return;
  const dated = await Promise.all(others.map(async (file) => ({ file, at: (await stat(file).catch(() => undefined))?.mtimeMs ?? 0 })));
  dated.sort((a, b) => b.at - a.at);
  for (const { file } of dated.slice(room)) await rm(file, { force: true }).catch(() => undefined);
}

/** Logs under `<workspaceRoot>/.openspec-ui/runs`, for a host to hand to
 * its runners. */
export function createFileRunLogs(workspaceRoot: string, options: { maxBytes?: number; keep?: number } = {}): RunLogs {
  const maxBytes = options.maxBytes ?? RUN_LOG_MAX_BYTES;
  const keep = options.keep ?? RUN_LOG_KEEP;
  const directory = path.join(workspaceRoot, RUN_LOG_DIRECTORY);
  return {
    open(start) {
      if (!isRunLogId(start.runId)) return { event: () => undefined, end: async () => undefined };
      const file = runLogPath(workspaceRoot, start.runId);
      let pending: string[] = [];
      let pendingBytes = 0;
      // What earlier stages of the same run wrote, once known, and what
      // this one has handed over since: together, what the file holds.
      let base = 0;
      let pushed = 0;
      let full = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      // One chain of writes, so the file keeps the order things happened
      // in. It starts by learning how much an earlier stage already wrote.
      let chain: Promise<void> = mkdir(directory, { recursive: true })
        .then(() => stat(file).then((s) => { base = s.size; }, () => undefined))
        .then(() => prune(directory, keep, file))
        .catch(() => undefined);

      const flush = (): Promise<void> => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
        if (pending.length === 0) return chain;
        const text = pending.join("");
        pending = [];
        pendingBytes = 0;
        chain = chain.then(() => appendFile(file, text, "utf8")).catch(() => undefined);
        return chain;
      };
      const hold = (record: RunLogRecord) => {
        const line = JSON.stringify(record) + NL;
        const bytes = Buffer.byteLength(line, "utf8");
        pending.push(line);
        pendingBytes += bytes;
        pushed += bytes;
      };
      const push = (record: RunLogRecord, always = false) => {
        if (!always) {
          if (full) return;
          const bytes = Buffer.byteLength(JSON.stringify(record) + NL, "utf8");
          if (base + pushed + bytes > maxBytes) {
            full = true;
            hold({
              type: "line",
              at: nowIso(),
              stream: "note",
              text: `The log stops here: it reached ${Math.round(maxBytes / 1024 / 1024)} MB. The run went on.`,
            });
            return;
          }
        }
        hold(record);
        if (pendingBytes >= FLUSH_BYTES) {
          void flush();
        } else if (timer === undefined) {
          timer = setTimeout(() => { void flush(); }, FLUSH_MS);
          timer.unref?.();
        }
      };

      push({ type: "start", at: nowIso(), ...start }, true);
      return {
        event(event) {
          const line = runLogLineOf(event);
          if (line === undefined || line.text.length === 0) return;
          push({ type: "line", at: event.timestamp ?? nowIso(), ...line });
        },
        async end(end) {
          push({ type: "end", at: nowIso(), ...end }, true);
          await flush();
        },
      };
    },
  };
}

function parseRecord(line: string): RunLogRecord | undefined {
  try {
    const value = JSON.parse(line) as { type?: unknown };
    return value && (value.type === "start" || value.type === "line" || value.type === "end") ? value as RunLogRecord : undefined;
  } catch {
    return undefined;
  }
}

const HEAD_BYTES = 16 * 1024;
const TAIL_BYTES = 16 * 1024;

async function readSlice(file: string, from: number, length: number): Promise<string> {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, from);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

/** One log's summary from its first and last lines, without reading what
 * lies between: a directory of two hundred logs of up to 5 MB each is
 * listed in the time it takes to open them. */
async function summarize(file: string, runId: string): Promise<RunLogSummary | undefined> {
  const size = (await stat(file)).size;
  const head = await readSlice(file, 0, Math.min(size, HEAD_BYTES));
  const first = parseRecord(head.split(NL)[0] ?? "");
  if (first?.type !== "start") return undefined;
  const tail = size <= HEAD_BYTES ? head : await readSlice(file, Math.max(0, size - TAIL_BYTES), Math.min(size, TAIL_BYTES));
  const tailRecords = tail.split(NL).map(parseRecord).filter((record): record is RunLogRecord => record !== undefined);
  const headRecords = head.split(NL).map(parseRecord).filter((record): record is RunLogRecord => record !== undefined);
  const last = [...tailRecords].reverse().find((record) => record.type === "end" || record.type === "start");
  const stages = [...new Set([...headRecords, ...tailRecords]
    .filter((record): record is RunLogStart => record.type === "start")
    .map((record) => record.stage ?? record.kind))];
  return {
    runId,
    agent: first.agent,
    kind: first.kind,
    ...(first.changeName !== undefined ? { changeName: first.changeName } : {}),
    stages,
    startedAt: first.at,
    ...(last?.type === "end"
      ? { endedAt: last.at, outcome: last.outcome, ...(last.reason !== undefined ? { reason: last.reason } : {}) }
      : {}),
    bytes: size,
  };
}

/** The runs a workspace kept logs of, newest first; only one change's
 * where a change is named. */
export async function listRunLogs(workspaceRoot: string, filter: { changeName?: string } = {}): Promise<RunLogSummary[]> {
  const directory = path.join(workspaceRoot, RUN_LOG_DIRECTORY);
  const names = await readdir(directory).catch(() => [] as string[]);
  const summaries = await Promise.all(names
    .filter((name) => name.endsWith(".jsonl") && isRunLogId(name.slice(0, -".jsonl".length)))
    .map((name) => summarize(path.join(directory, name), name.slice(0, -".jsonl".length)).catch(() => undefined)));
  return summaries
    .filter((summary): summary is RunLogSummary => summary !== undefined)
    .filter((summary) => filter.changeName === undefined || summary.changeName === filter.changeName)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** One run's log, record by record; `undefined` where there is none. A
 * line that cannot be read is skipped, as a half-written last line is. */
export async function readRunLog(workspaceRoot: string, runId: string): Promise<RunLogRecord[] | undefined> {
  if (!isRunLogId(runId)) return undefined;
  const text = await readFile(runLogPath(workspaceRoot, runId), "utf8").catch(() => undefined);
  if (text === undefined) return undefined;
  return text.split(NL).map(parseRecord).filter((record): record is RunLogRecord => record !== undefined);
}
