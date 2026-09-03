// ACP-flavored adapter counterpart for Claude CLI. Unlike the other three
// ACP-flavored adapters, this one does NOT speak ACP at all — `claude` has
// no native ACP mode, and its official ACP bridge
// (`@agentclientprotocol/claude-agent-acp`) requires `ANTHROPIC_API_KEY`
// directly, incompatible with an OAuth-authenticated `claude login`
// session (see design.md's "claude-cli-acp translates progress only; the
// official SDK-based bridge is rejected"). Instead this adapter spawns
// `claude`'s own documented `--input-format stream-json --output-format
// stream-json` non-interactive streaming mode directly (`--print` is
// required for either flag to do anything — confirmed in `claude --help`)
// and translates its structured message stream (each stdout line is one
// JSON object: `type` `"system"`/`"assistant"`/`"user"`/`"result"`) into
// `agentUpdate` events.
//
// `--dangerously-skip-permissions` is included for the same reason
// claude.ts's raw-text adapter already includes it: this project's real
// security boundary is checkCwdSandbox + the allowlist + AuditLog
// (security.ts), not any individual CLI's own interactive prompts — see
// claude.ts's header comment. Without it, every non-trivial tool call
// would fail closed exactly as design.md's live spike found (`system`/
// `permission_denied`, no `control_request` ever offered back over
// stdin), which is why this adapter never emits a `permissionRequest`
// event (see acp-agent-adapters spec.md's "Claude CLI adapter never emits
// a permission request" — this file deliberately has no
// `resolvePermission` method at all, not even a stub).

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { AgentUsage, AgentUsageByModel } from "../agent-usage.js";
import type { AgentUpdateEvent, Command, Event } from "../protocol.js";
import { commandInstruction, spawnAndStream } from "./shared.js";

function nowIso(): string {
  return new Date().toISOString();
}

interface ClaudeStreamResult {
  isError: boolean;
  summary?: string;
}

function tryParseClaudeStreamLine(line: string): Record<string, unknown> | undefined {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("{")) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Reads what `claude`'s own terminal `"result"` line reported it spent.
 * This adapter does not speak ACP (see the header comment), so it has no
 * `PromptResponse.usage` to read — but the stream it does parse carries
 * the same facts, vendor-computed, on that one line: `total_cost_usd`, a
 * `usage` object in the API's snake_case, and a per-model `modelUsage`
 * split. Nothing here is derived from a price table, and a field the line
 * did not carry stays absent (see agent-usage.ts). Returns `undefined`
 * when the line reported nothing at all, so "not reported" never becomes
 * a zero. */
export function buildClaudeResultUsage(parsed: Record<string, unknown>): AgentUsage | undefined {
  const usage: AgentUsage = {};

  const costUsd = numberOrUndefined(parsed.total_cost_usd);
  if (costUsd !== undefined) usage.costUsd = costUsd;

  const reported = parsed.usage as Record<string, unknown> | null | undefined;
  if (reported && typeof reported === "object") {
    const inputTokens = numberOrUndefined(reported.input_tokens);
    const outputTokens = numberOrUndefined(reported.output_tokens);
    const cacheCreation = numberOrUndefined(reported.cache_creation_input_tokens);
    const cacheRead = numberOrUndefined(reported.cache_read_input_tokens);
    if (inputTokens !== undefined) usage.inputTokens = inputTokens;
    if (outputTokens !== undefined) usage.outputTokens = outputTokens;
    if (cacheCreation !== undefined) usage.cacheCreationInputTokens = cacheCreation;
    if (cacheRead !== undefined) usage.cacheReadInputTokens = cacheRead;
  }

  const modelUsage = parsed.modelUsage as Record<string, unknown> | null | undefined;
  if (modelUsage && typeof modelUsage === "object") {
    const byModel: Record<string, AgentUsageByModel> = {};
    for (const [model, raw] of Object.entries(modelUsage)) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const perModel: AgentUsageByModel = {};
      const inputTokens = numberOrUndefined(entry.inputTokens);
      const outputTokens = numberOrUndefined(entry.outputTokens);
      // `costUSD` — this line's own spelling for the per-model field,
      // which differs from `total_cost_usd` beside it.
      const perModelCost = numberOrUndefined(entry.costUSD);
      if (inputTokens !== undefined) perModel.inputTokens = inputTokens;
      if (outputTokens !== undefined) perModel.outputTokens = outputTokens;
      if (perModelCost !== undefined) perModel.costUsd = perModelCost;
      if (Object.keys(perModel).length > 0) byModel[model] = perModel;
    }
    if (Object.keys(byModel).length > 0) usage.byModel = byModel;
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

function extractResult(parsed: Record<string, unknown>): ClaudeStreamResult | undefined {
  if (parsed.type !== "result") return undefined;
  const isError = parsed.is_error === true || (typeof parsed.subtype === "string" && parsed.subtype !== "success");
  const summary = typeof parsed.result === "string" ? parsed.result : undefined;
  return { isError, summary };
}

/** Translates `spawnAndStream`'s raw stdout stream — one JSON object per
 * line, per `claude`'s own `--output-format stream-json` — into
 * `agentUpdate` events, buffering across chunk boundaries (a single
 * `stdout` event is not guaranteed to align with a line boundary). A line
 * that does not parse as JSON is passed through unchanged as `stdout` —
 * the same "conservative parsing" fallback shared.ts's own header
 * describes, applied one layer up: an unrecognized line degrades this
 * adapter to plain text for that one line, not to a broken event stream.
 * The final `"result"` line (if one arrives) determines whether the run's
 * own terminal event is `completed`/`failed` and its summary/reason —
 * more accurate than the underlying process's raw exit code alone, since
 * `claude -p` can exit 0 while `result.is_error` is true. */
export async function* translateClaudeStream(source: AsyncGenerator<Event>, runId: string): AsyncGenerator<Event> {
  let buffer = "";
  let lastResult: ClaudeStreamResult | undefined;
  let lastUsage: AgentUsage | undefined;

  for await (const event of source) {
    if (event.kind !== "stdout") {
      if (event.kind === "completed" && lastResult) {
        // Emitted before the terminal event, because agent-runner.ts
        // writes the run's audit entry as soon as the stream ends — a
        // report arriving after the terminal event would be recorded
        // nowhere.
        if (lastUsage) yield { kind: "usageReported", runId, timestamp: nowIso(), usage: lastUsage };
        yield lastResult.isError
          ? { kind: "failed", runId, timestamp: nowIso(), reason: lastResult.summary ?? "claude reported an error" }
          : { kind: "completed", runId, timestamp: nowIso(), summary: lastResult.summary };
        continue;
      }
      yield event;
      continue;
    }

    buffer += event.chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const parsed = tryParseClaudeStreamLine(line);
      if (!parsed) {
        if (line.trim().length > 0) yield { kind: "stdout", runId, timestamp: nowIso(), chunk: `${line}\n` };
        continue;
      }
      const result = extractResult(parsed);
      if (result) {
        lastResult = result;
        // Kept only when this line actually carried numbers: a later
        // result line reporting none must not erase an earlier report.
        lastUsage = buildClaudeResultUsage(parsed) ?? lastUsage;
      }
      const update: AgentUpdateEvent = {
        kind: "agentUpdate",
        runId,
        timestamp: nowIso(),
        update: { sessionUpdate: String(parsed.type ?? "update"), ...parsed },
      };
      yield update;
    }
  }
}

export class ClaudeCliAcpAdapter implements AgentAdapter {
  readonly name = "claude-cli-acp";

  buildInvocation(command: Command): AdapterInvocation {
    const args = [
      "-p",
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
    ];
    if (command.model) args.push("--model", command.model);
    if (command.effort) args.push("--effort", command.effort);
    if (command.budget?.maxCostUsd !== undefined) args.push("--max-budget-usd", String(command.budget.maxCostUsd));
    return { kind: "process", executable: "claude", args };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("ClaudeCliAcpAdapter expects invocation.kind === 'process'");
    }
    const userMessage = JSON.stringify({
      type: "user",
      message: { role: "user", content: `${commandInstruction(command.kind)}\n\n${prompt}` },
    });
    const rawStream = spawnAndStream({
      executable: invocation.executable,
      args: invocation.args,
      cwd: command.cwd,
      runId: command.runId,
      commandKind: command.kind,
      stdin: `${userMessage}\n`,
      signal,
    });
    yield* translateClaudeStream(rawStream, command.runId);
  }
}
