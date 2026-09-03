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
  client,
  ndJsonStream,
  type AgentApp,
  type PermissionOption,
  type Stream,
  type ToolCallUpdate,
} from "@agentclientprotocol/sdk";
import type { AgentUsage } from "../agent-usage.js";
import type { CommandKind, Event } from "../protocol.js";
import { KILL_CONFIRMATION_TIMEOUT_MS, terminateProcessTree } from "./shared.js";

function nowIso(): string {
  return new Date().toISOString();
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
export function spawnAcpProcess(
  executable: string,
  args: string[],
  cwd: string,
): { target: Stream; child: ChildProcessWithoutNullStreams } {
  const child = crossSpawn(executable, args, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    ...(process.platform !== "win32" ? { detached: true } : {}),
  }) as ChildProcessWithoutNullStreams;
  // ACP only speaks over stdin/stdout — stderr is not part of the ACP
  // stream itself; this module does not forward it (an ACP-flavored
  // adapter has no `stderr` event today, matching the fact that
  // `agentUpdate`/`permissionRequest` are its only new event kinds).
  const target = ndJsonStream(
    Writable.toWeb(child.stdin) as unknown as WritableStream<Uint8Array>,
    Readable.toWeb(child.stdout) as unknown as ReadableStream<Uint8Array>,
  );
  return { target, child };
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
  /** Set by `runProcess`, which owns the child and therefore owns the
   * terminal event on abort — see the `__aborted__` branch in `run()`. */
  deferAbortTerminalEvent?: boolean;
}

export interface RunAcpProcessOptions {
  executable: string;
  args: string[];
  cwd: string;
  runId: string;
  commandKind: CommandKind;
  prompt: string;
  signal: AbortSignal;
  /** Set by `runProcess`, which owns the child and therefore owns the
   * terminal event on abort — see the `__aborted__` branch in `run()`. */
  deferAbortTerminalEvent?: boolean;
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
    if (typeof reported.cacheReadTokens === "number") usage.cacheReadInputTokens = reported.cacheReadTokens;
    if (typeof reported.cacheCreationTokens === "number") usage.cacheCreationInputTokens = reported.cacheCreationTokens;
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
  private readonly pending = new Map<string, (outcome: "allow" | "deny") => void>();

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
    app.onRequest(CLIENT_METHODS.session_request_permission, async ({ params }) => {
      const requestId = crypto.randomUUID();
      push({
        kind: "permissionRequest",
        runId,
        timestamp: nowIso(),
        requestId,
        description: describeToolCall(params.toolCall),
      });
      const outcome = await new Promise<"allow" | "deny">((resolve) => {
        this.pending.set(`${runId}:${requestId}`, resolve);
      });
      const optionId = pickOptionId(params.options, outcome);
      if (!optionId) {
        return { outcome: { outcome: "cancelled" as const } };
      }
      return { outcome: { outcome: "selected" as const, optionId } };
    });

    const runSession = async (ctx: import("@agentclientprotocol/sdk").ClientContext): Promise<void> => {
      await ctx.request("initialize", { protocolVersion: PROTOCOL_VERSION });
      await ctx.buildSession(cwd).withSession(async (session) => {
        const promptResult = session.prompt(prompt);
        // The last cost an in-flight `usage_update` reported. Only its
        // `cost` is kept: `used` is tokens currently *in context*, which
        // goes down after a compaction, so recording it as consumption
        // would under-count a long run exactly when it compacts.
        let streamedCost: { amount: number; currency: string } | undefined;
        for (;;) {
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
            yield { kind: "failed", runId, timestamp: nowIso(), reason: "agent refused the prompt" };
          } else {
            yield { kind: "completed", runId, timestamp: nowIso() };
          }
        } else if (item.kind === "__error__") {
          done = true;
          yield {
            kind: "failed",
            runId,
            timestamp: nowIso(),
            reason: item.error instanceof Error ? item.error.message : String(item.error),
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

    if (signal.aborted) {
      yield { kind: "cancelled", runId, timestamp: nowIso() };
      return;
    }

    let spawned: { target: Stream; child: ChildProcessWithoutNullStreams };
    try {
      spawned = spawnAcpProcess(executable, args, cwd);
    } catch (err) {
      yield {
        kind: "failed",
        runId,
        timestamp: nowIso(),
        reason: err instanceof Error ? err.message : String(err),
      };
      return;
    }

    const { target, child } = spawned;

    // The child's own exit is the only authority on whether cancellation
    // took effect. An ACP process is long-lived, which is why this
    // adapter kills a tree at all — and why it is the adapter the
    // "cancelled but still working" report came from.
    let exited = false;
    const exitedPromise = new Promise<void>((resolve) => {
      child.once("close", () => {
        exited = true;
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
      yield* this.run({ target, cwd, runId, commandKind, prompt, signal, deferAbortTerminalEvent: true });

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
          yield {
            kind: "failed",
            runId,
            timestamp: nowIso(),
            reason: killFailure
              ? `cancellation could not be carried out: ${killFailure}. The agent process may still be running.`
              : `the agent process did not exit within ${KILL_CONFIRMATION_TIMEOUT_MS / 1000}s of being terminated, and may still be running.`,
          };
        }
      }
    } finally {
      signal.removeEventListener("abort", onAbort);
      if (child.pid !== undefined) void terminateProcessTree(child.pid);
    }
  }
}
