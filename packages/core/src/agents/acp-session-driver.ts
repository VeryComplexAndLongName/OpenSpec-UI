// Shared ACP (Agent Client Protocol, agentclientprotocol.com — a JSON-RPC,
// session-based protocol distinct from and unrelated to MCP) session
// driver, reused by every ACP-flavored AgentAdapter (copilot-cli-acp,
// gemini-cli-acp, codex-cli-acp, claude-cli-acp — see design.md, "Shared
// ACP session driver built on @agentclientprotocol/sdk"). Owns ACP session
// lifecycle (initialize, session/new, session/prompt, session/update,
// session/request_permission) and translates it into this project's own
// Event union (`agentUpdate`/`permissionRequest`).
//
// `run()` takes a `target` (a live subprocess's stdio wrapped as an ACP
// `Stream`, or an in-process `AgentApp`) rather than an executable/args
// pair — deliberately, so unit tests can drive it against a mocked ACP
// peer with no real process involved (tasks.md 2.3). Spawning a real
// process is `runProcess()`'s own concern, layered on top of `run()`, not
// this driver's core translation logic.

import crossSpawn from "cross-spawn";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
  CLIENT_METHODS,
  PROTOCOL_VERSION,
  RequestError,
  client,
  ndJsonStream,
  type AgentApp,
  type PermissionOption,
  type SessionConfigOption,
  type Stream,
  type ToolCallUpdate,
} from "@agentclientprotocol/sdk";
import os from "node:os";
import type { AgentUsage } from "../agent-usage.js";
import { say } from "../message-register.js";
import { commandLineHash, defaultProcessLedger, type ProcessLedger } from "../process-ledger.js";
import { readProcessStartTime, type StartTimeReader } from "../process-start-time.js";
import type { CommandKind, Event } from "../protocol.js";
import { agentSpawnEnvironment, KILL_CONFIRMATION_TIMEOUT_MS, terminateProcessTree } from "./shared.js";

function nowIso(): string {
  return new Date().toISOString();
}

/** A connection failure's reason, for a run's `failed` event.
 *
 * The SDK's own catch-all (`errorToResult`) turns any handler exception
 * into a `RequestError` whose `message` is the fixed string "Internal
 * error" — code -32603 always reads that, by the JSON-RPC spec — with
 * the original exception's own message kept only in `data.details` (an
 * `HTTP 401 Unauthorized: ...` from `chat-client.ts`, say). Reading only
 * `.message`, as this driver did, reported every one of those as the same
 * unhelpful "Internal error" no matter what actually failed underneath. */
function connectionFailureReason(error: unknown): string {
  if (error instanceof RequestError) {
    const data = error.data;
    if (typeof data === "object" && data !== null && "details" in data && typeof (data as { details: unknown }).details === "string") {
      return (data as { details: string }).details;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/** Either a live subprocess's stdio (production, via `spawnAcpProcess`) or
 * an in-process `AgentApp` (tests) — see this file's header comment. */
export type AcpConnectTarget = Stream | AgentApp;

/** Spawns `executable args` and wraps its stdio as an ACP `Stream` — the
 * one piece of this module that touches a real process. `cross-spawn`
 * (not plain `node:child_process.spawn`) for the same Windows `.cmd`-shim
 * resolution reason as shared.ts's spawnAndStream. Throws synchronously on
 * a spawn failure (e.g. `ENOENT`), exactly like `crossSpawn` itself —
 * callers (`runProcess` below) are expected to catch it. */
/** How much of an agent's stderr is kept to say beside a failure: its
 * last lines, enough to hold a stack trace's head or a CLI's own error. */
export const ACP_STDERR_TAIL_CHARS = 4000;

/** What an ACP agent wrote to stderr: drained as it arrives, so a talkative
 * agent never fills the pipe and stalls (an-acp-agent-is-heard-on-stderr),
 * handed on in chunks, and its tail kept for a failure's reason. */
export class AcpStderr {
  private pending: string[] = [];
  private kept = "";

  constructor(stream: NodeJS.ReadableStream | undefined) {
    if (stream === undefined) return;
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => this.add(chunk));
    // A pipe that errors says nothing more; it must not crash the run.
    stream.on("error", () => undefined);
  }

  add(chunk: string): void {
    if (chunk.length === 0) return;
    this.pending.push(chunk);
    this.kept = (this.kept + chunk).slice(-ACP_STDERR_TAIL_CHARS);
  }

  /** What arrived since the last call, in order. */
  take(): string[] {
    const taken = this.pending;
    this.pending = [];
    return taken;
  }

  /** Its last characters, trimmed; empty where it wrote nothing. */
  tail(): string {
    return this.kept.trim();
  }
}

/** A failure's reason with what the agent last wrote to stderr after it,
 * where it wrote anything: a connection that closed says nothing of why,
 * and the agent usually did. */
export function withStderrTail(reason: string, tail: string): string {
  return tail.length === 0 ? reason : `${reason}\nThe agent's stderr ended with:\n${tail}`;
}

export function spawnAcpProcess(
  executable: string,
  args: string[],
  cwd: string,
  env?: Readonly<Record<string, string>>,
): { target: Stream; child: ChildProcessWithoutNullStreams; stderr: AcpStderr } {
  const spawnEnv = agentSpawnEnvironment(env);
  const child = crossSpawn(executable, args, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    ...(spawnEnv !== undefined ? { env: spawnEnv } : {}),
    ...(process.platform !== "win32" ? { detached: true } : {}),
  }) as ChildProcessWithoutNullStreams;
  // ACP speaks over stdin/stdout. stderr is not part of the protocol, and
  // was left unread: a pipe nobody drains fills, and an agent writing its
  // logs there stalls mid-run, with whatever it said of a failure lost.
  // It is read from the start and handed on as the raw-text adapters
  // hand theirs (an-acp-agent-is-heard-on-stderr).
  const stderr = new AcpStderr(child.stderr);
  const target = ndJsonStream(
    Writable.toWeb(child.stdin) as unknown as WritableStream<Uint8Array>,
    Readable.toWeb(child.stdout) as unknown as ReadableStream<Uint8Array>,
  );
  return { target, child, stderr };
}

export interface AcpRunOptions {
  target: AcpConnectTarget;
  cwd: string;
  runId: string;
  commandKind: CommandKind;
  /** Full prompt text (already includes `commandInstruction(...)`, per
   * this project's existing convention in every other adapter) sent as
   * the ACP `session/prompt` message. Unlike the raw-text adapters, this
   * never needs truncation or a fallback — ACP carries it over stdio, not
   * argv (see design.md / ADR 0013's argv-cap finding). */
  prompt: string;
  signal?: AbortSignal;
  /** Session options set with `session/set_config_option` before the
   * prompt, in order — each one checked first against what `session/new`
   * said the agent offers (codex-cli-acp-is-a-full-agent). `agent` is
   * the name a refusal says. */
  sessionOptions?: { agent: string; set: readonly AcpSessionOption[] };
  /** Set by `runProcess`, which owns the child and therefore owns the
   * terminal event on abort — see the `__aborted__` branch in `run()`. */
  deferAbortTerminalEvent?: boolean;
}

export interface RunAcpProcessOptions {
  executable: string;
  args: string[];
  cwd: string;
  env?: Readonly<Record<string, string>>;
  runId: string;
  commandKind: CommandKind;
  prompt: string;
  signal: AbortSignal;
  sessionOptions?: AcpRunOptions["sessionOptions"];
  /** Where to record the spawn snapshot (ADR 0050). Defaults to the shared
   * per-working-directory ledger when omitted. */
  ledger?: ProcessLedger;
  /** How to read the child's OS start time; injectable for tests. */
  startTimeReader?: StartTimeReader;
}

/** Builds this project's own usage shape from what ACP reported, taking
 * only fields the agent actually sent.
 *
 * `PromptResponse.usage` is the better source — per-turn totals rather
 * than a context gauge — and the SDK marks it `UNSTABLE`/`@experimental`,
 * which is exactly why the streamed cost is a fallback rather than an
 * afterthought: a ceiling that silently stops working at the next SDK
 * bump is worse than one that never worked, because by then someone
 * trusts it.
 *
 * Returns `undefined` when nothing was reported. An absent usage means
 * "not reported", which `checkBudget` fails open on; a zero would convert
 * that into "it cost nothing". */
export function buildAcpUsage(
  responseUsage: unknown,
  streamedCost: { amount: number; currency: string } | undefined,
): AgentUsage | undefined {
  const usage: AgentUsage = {};
  const reported = responseUsage as Record<string, unknown> | null | undefined;

  if (reported && typeof reported === "object") {
    if (typeof reported.inputTokens === "number") usage.inputTokens = reported.inputTokens;
    if (typeof reported.outputTokens === "number") usage.outputTokens = reported.outputTokens;
    if (typeof reported.thoughtTokens === "number") usage.thoughtTokens = reported.thoughtTokens;
    // The schema's own spelling. The names read here before were nobody's,
    // so no ACP agent's cached input was ever recorded (found against
    // codex-acp 2.2.2 on 2026-10-24).
    if (typeof reported.cachedReadTokens === "number") usage.cacheReadInputTokens = reported.cachedReadTokens;
    if (typeof reported.cachedWriteTokens === "number") usage.cacheCreationInputTokens = reported.cachedWriteTokens;
  }

  if (streamedCost) {
    // USD goes in the field named for it; anything else keeps its own
    // currency rather than being converted at a rate this project would
    // have to invent.
    if (streamedCost.currency.toUpperCase() === "USD") usage.costUsd = streamedCost.amount;
    else usage.cost = streamedCost;
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

/** One session option to set: the agent's own id for it (`model`,
 * `reasoning_effort`, `mode`) and the value, as `session/new` lists them. */
export interface AcpSessionOption {
  id: string;
  value: string;
}

/** Why `option` cannot be set on a session whose `session/new` offered
 * `offered`, naming what there is — or `undefined` when it can. A value
 * the agent did not list is refused rather than sent: an agent may take
 * it silently and run with something else. */
export function refuseSessionOption(
  agent: string,
  offered: readonly SessionConfigOption[] | null | undefined,
  option: AcpSessionOption,
): { code: string; text: string } | undefined {
  const found = (offered ?? []).find((candidate) => candidate.id === option.id);
  if (found === undefined) {
    const ids = (offered ?? []).map((candidate) => candidate.id);
    return say("OSW-AGT-223", { agent, option: option.id, offered: ids.length > 0 ? ids.join(", ") : "none" });
  }
  if (found.type !== "select") return undefined;
  const values = found.options.flatMap((entry) => ("group" in entry ? entry.options : [entry])).map((entry) => entry.value);
  if (values.includes(option.value)) return undefined;
  return say("OSW-AGT-224", { agent, option: option.id, values: values.join(", "), value: option.value });
}

function describeToolCall(toolCall: ToolCallUpdate): string {
  return toolCall.title ?? toolCall.toolCallId;
}

/** Maps this project's own coarse `"allow"`/`"deny"` outcome (see
 * design.md's "New protocol members") onto whichever concrete
 * `PermissionOption` the peer offered — preferring the "once" variant over
 * "always" so a single answered request never silently pre-authorizes
 * every future one. `undefined` means the peer offered no option of the
 * requested kind, which is answered as `"cancelled"` (see `run()` below),
 * never as a guess at some other option. */
function pickOptionId(options: readonly PermissionOption[], outcome: "allow" | "deny"): string | undefined {
  const wantedPrefix = outcome === "allow" ? "allow" : "reject";
  const once = options.find((option) => option.kind === `${wantedPrefix}_once`);
  if (once) return once.optionId;
  return options.find((option) => option.kind.startsWith(wantedPrefix))?.optionId;
}

/** One driver instance is shared by every run of one ACP-flavored adapter
 * (mirrors `agent-runner.ts`'s own per-adapter `activeRuns` map for
 * `"cancel"`) — `resolvePermission` below is how a later, separate
 * `"resolvePermission"` Command reaches the still-active `run()` generator
 * below that is awaiting an answer for some earlier `runId`. */
export class AcpSessionDriver {
  private readonly pending = new Map<string, (outcome: "allow" | "deny" | "withdrawn") => void>();

  /** Resolves a still-pending `session/request_permission` call for
   * `runId`/`requestId`. Returns `false` (a no-op, not an error) if no
   * such request is pending — e.g. it was already resolved, or the
   * requestId/runId is stale (design.md's "resolvePermission" scenario:
   * "no second `permissionRequest` is emitted for the same action"). */
  resolvePermission(runId: string, requestId: string, outcome: "allow" | "deny"): boolean {
    const key = `${runId}:${requestId}`;
    const resolve = this.pending.get(key);
    if (!resolve) return false;
    this.pending.delete(key);
    resolve(outcome);
    return true;
  }

  /** Core translation logic: speaks ACP against `target`, yielding
   * `agentUpdate`/`permissionRequest` (and the usual `started`/
   * `completed`/`failed`/`cancelled`) — no process management. */
  async *run(options: AcpRunOptions): AsyncGenerator<Event> {
    const { target, cwd, runId, commandKind, prompt, signal } = options;

    if (signal?.aborted) {
      yield { kind: "cancelled", runId, timestamp: nowIso() };
      return;
    }

    type QueueItem =
      | Event
      | { kind: "__stop__"; stopReason: string }
      | { kind: "__refused__"; code: string; text: string }
      | { kind: "__error__"; error: unknown }
      | { kind: "__aborted__" };
    const queue: QueueItem[] = [];
    let resolveWake: (() => void) | null = null;
    const wake = () => {
      resolveWake?.();
      resolveWake = null;
    };
    const push = (item: QueueItem) => {
      queue.push(item);
      wake();
    };

    let aborted = false;
    const onAbort = () => {
      if (aborted) return;
      aborted = true;
      queue.length = 0;
      push({ kind: "__aborted__" });
    };
    signal?.addEventListener("abort", onAbort);

    const app = client({ name: "openspec-ui" });
    // TypeScript cannot distribute a union argument across `connectWith`'s
    // two overloads (`Stream` vs `AgentApp`) — a runtime discriminant
    // (`AgentApp` is the only one of the two with a `connect` method)
    // picks the matching overload explicitly instead of widening the
    // parameter type or casting away the distinction.
    const isAgentApp = (value: AcpConnectTarget): value is AgentApp => "connect" in value;
    // The requests this run has asked and nobody has answered, so the ones
    // still open when its turn ends can be said to be withdrawn.
    const openRequests = new Set<string>();
    const withdraw = (requestId: string) => {
      const resolve = this.pending.get(`${runId}:${requestId}`);
      if (resolve === undefined) return;
      this.pending.delete(`${runId}:${requestId}`);
      openRequests.delete(requestId);
      push({ kind: "permissionSettled", runId, timestamp: nowIso(), requestId, outcome: "withdrawn" });
      resolve("withdrawn");
    };
    app.onRequest(CLIENT_METHODS.session_request_permission, async ({ params, signal: requestSignal }) => {
      const requestId = crypto.randomUUID();
      push({
        kind: "permissionRequest",
        runId,
        timestamp: nowIso(),
        requestId,
        description: describeToolCall(params.toolCall),
      });
      const outcome = await new Promise<"allow" | "deny" | "withdrawn">((resolve) => {
        this.pending.set(`${runId}:${requestId}`, (answer) => {
          openRequests.delete(requestId);
          // Said in this run's stream whichever surface answered, so the
          // others stop offering it.
          if (answer !== "withdrawn") push({ kind: "permissionSettled", runId, timestamp: nowIso(), requestId, outcome: answer });
          resolve(answer);
        });
        openRequests.add(requestId);
        // The agent cancels a request it no longer waits on (`$/cancel_request`):
        // copilot-cli-acp does when a tool call beside it fails, and goes on.
        if (requestSignal?.aborted) withdraw(requestId);
        else requestSignal?.addEventListener("abort", () => withdraw(requestId), { once: true });
      });
      if (outcome === "withdrawn") {
        return { outcome: { outcome: "cancelled" as const } };
      }
      const optionId = pickOptionId(params.options, outcome);
      if (!optionId) {
        return { outcome: { outcome: "cancelled" as const } };
      }
      return { outcome: { outcome: "selected" as const, optionId } };
    });

    const runSession = async (ctx: import("@agentclientprotocol/sdk").ClientContext): Promise<void> => {
      await ctx.request("initialize", { protocolVersion: PROTOCOL_VERSION });
      await ctx.buildSession(cwd).withSession(async (session) => {
        const { agent, set } = options.sessionOptions ?? { agent: "", set: [] };
        // Every option is checked before the first is set, so a refusal
        // leaves nothing half-applied.
        for (const option of set) {
          const refusal = refuseSessionOption(agent, session.newSessionResponse.configOptions, option);
          if (refusal) {
            push({ kind: "__refused__", ...refusal });
            return;
          }
        }
        for (const option of set) {
          await ctx.request("session/set_config_option", { sessionId: session.sessionId, configId: option.id, value: option.value });
        }
        const promptResult = session.prompt(prompt);
        // The last cost an in-flight `usage_update` reported. Only its
        // `cost` is kept: `used` is tokens currently *in context*, which
        // goes down after a compaction, so recording it as consumption
        // would under-count a long run exactly when it compacts.
        let streamedCost: { amount: number; currency: string } | undefined;
        for (; ;) {
          const message = await session.nextUpdate();
          if (message.kind === "stop") break;
          const update = message.notification.update as unknown as Record<string, unknown>;
          if (update.sessionUpdate === "usage_update") {
            const cost = update.cost as { amount?: unknown; currency?: unknown } | null | undefined;
            if (cost && typeof cost.amount === "number" && typeof cost.currency === "string") {
              streamedCost = { amount: cost.amount, currency: cost.currency };
            }
          }
          // Forwarded verbatim, exactly as before — this observes the
          // stream, it does not filter it.
          push({ kind: "agentUpdate", runId, timestamp: nowIso(), update });
        }
        const response = await promptResult;
        const usage = buildAcpUsage(
          (response as { usage?: unknown }).usage,
          streamedCost,
        );
        if (usage) push({ kind: "usageReported", runId, timestamp: nowIso(), usage });
        // A request still open when the turn has ended waits on nothing.
        for (const requestId of [...openRequests]) withdraw(requestId);
        push({ kind: "__stop__", stopReason: response.stopReason });
      });
    };
    const connection = isAgentApp(target) ? app.connectWith(target, runSession) : app.connectWith(target, runSession);
    connection.catch((error: unknown) => {
      if (!aborted) push({ kind: "__error__", error });
    });

    try {
      yield { kind: "started", runId, timestamp: nowIso(), command: commandKind, cwd };

      let done = false;
      while (!done) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveWake = resolve;
          });
          continue;
        }
        const item = queue.shift() as QueueItem;
        if (item.kind === "__aborted__") {
          done = true;
          // When a caller owns the process (`runProcess`), it owns the
          // terminal event too: only the child's own exit can say the
          // cancellation took effect, and this generator cannot see it.
          // Emitting `cancelled` here is what let a run report itself
          // stopped while `copilot --acp` carried on working.
          if (!options.deferAbortTerminalEvent) {
            yield { kind: "cancelled", runId, timestamp: nowIso() };
          }
        } else if (item.kind === "__stop__") {
          done = true;
          if (item.stopReason === "cancelled") {
            yield { kind: "cancelled", runId, timestamp: nowIso() };
          } else if (item.stopReason === "refusal") {
            yield { kind: "failed", runId, timestamp: nowIso(), reason: say("OSW-AGT-218").text, code: "OSW-AGT-218" };
          } else {
            yield { kind: "completed", runId, timestamp: nowIso() };
          }
        } else if (item.kind === "__refused__") {
          done = true;
          yield { kind: "failed", runId, timestamp: nowIso(), reason: item.text, code: item.code };
        } else if (item.kind === "__error__") {
          done = true;
          yield {
            kind: "failed",
            runId,
            timestamp: nowIso(),
            reason: connectionFailureReason(item.error),
          };
        } else {
          yield item;
        }
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }

  /** Spawns `executable args`, drives `run()` against its stdio, and
   * terminates the process tree both on abort and once the run ends —
   * unlike the raw-text adapters' short-lived CLI invocation, an
   * ACP-speaking process (`copilot --acp` etc.) is a long-lived server
   * that would otherwise keep listening on stdio after this one prompt
   * turn finishes. */
  async *runProcess(options: RunAcpProcessOptions): AsyncGenerator<Event> {
    const { executable, args, cwd, runId, commandKind, prompt, signal } = options;
    const ledger = options.ledger ?? defaultProcessLedger(cwd);
    const startTimeReader = options.startTimeReader ?? readProcessStartTime;

    if (signal.aborted) {
      yield { kind: "cancelled", runId, timestamp: nowIso() };
      return;
    }

    let spawned: { target: Stream; child: ChildProcessWithoutNullStreams; stderr: AcpStderr };
    try {
      spawned = spawnAcpProcess(executable, args, cwd, options.env);
    } catch (err) {
      yield {
        kind: "failed",
        runId,
        timestamp: nowIso(),
        reason: err instanceof Error ? err.message : String(err),
      };
      return;
    }

    const { target, child, stderr } = spawned;
    // What the agent wrote to stderr, before each event of the run and once
    // more at its end, so it reads in the order it was written.
    const stderrEvents = function* (): Generator<Event> {
      for (const chunk of stderr.take()) yield { kind: "stderr", runId, timestamp: nowIso(), chunk };
    };

    const spawnedPid = child.pid;
    if (spawnedPid !== undefined && ledger !== undefined) {
      ledger.record({
        runId,
        pid: spawnedPid,
        executablePath: executable,
        hostname: os.hostname(),
        cwd,
        commandLineHash: commandLineHash(executable, args),
        spawnedAt: nowIso(),
      });
      void startTimeReader(spawnedPid).then((startTime) => {
        if (startTime !== undefined) ledger.setStartTime(runId, spawnedPid, startTime.toISOString());
      }).catch(() => undefined);
    }

    // The child's own exit is the only authority on whether cancellation
    // took effect. An ACP process is long-lived, which is why this
    // adapter kills a tree at all — and why it is the adapter the
    // "cancelled but still working" report came from.
    let exited = false;
    const exitedPromise = new Promise<void>((resolve) => {
      child.once("close", () => {
        exited = true;
        if (spawnedPid !== undefined && ledger !== undefined) ledger.markExited(runId, spawnedPid, nowIso());
        resolve();
      });
    });

    let killFailure: string | undefined;
    const onAbort = () => {
      if (child.pid === undefined) return;
      void terminateProcessTree(child.pid).then((outcome) => {
        if (!outcome.attempted) killFailure = outcome.reason;
      });
    };
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      for await (const event of this.run({
        target, cwd, runId, commandKind, prompt, signal, deferAbortTerminalEvent: true,
        ...(options.sessionOptions !== undefined ? { sessionOptions: options.sessionOptions } : {}),
      })) {
        yield* stderrEvents();
        // A failure says what the agent last wrote to stderr: a closed
        // connection or a refusal says nothing of why, and the agent
        // usually did.
        yield event.kind === "failed" ? { ...event, reason: withStderrTail(event.reason, stderr.tail()) } : event;
      }
      yield* stderrEvents();

      if (signal.aborted) {
        // `run()` deferred the terminal event to here. Wait for the
        // process to actually go, and say so only then.
        if (!exited) {
          await Promise.race([
            exitedPromise,
            new Promise<void>((resolve) => setTimeout(resolve, KILL_CONFIRMATION_TIMEOUT_MS)),
          ]);
        }
        if (exited) {
          yield { kind: "cancelled", runId, timestamp: nowIso() };
        } else {
          const failure = killFailure
            ? say("OSW-AGT-219", { killFailure })
            : say("OSW-AGT-220", { seconds: KILL_CONFIRMATION_TIMEOUT_MS / 1000 });
          yield {
            kind: "failed",
            runId,
            timestamp: nowIso(),
            reason: failure.text,
            code: failure.code,
          };
        }
      }
    } finally {
      signal.removeEventListener("abort", onAbort);
      if (child.pid !== undefined) void terminateProcessTree(child.pid);
    }
  }
}
