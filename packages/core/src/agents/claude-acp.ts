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
// `agentUpdate` events. Where ACP has a counterpart — the agent's text,
// its thinking, a tool call and its result — the update is that ACP
// session update rather than Claude's own line, so every surface reads one
// protocol and none of them knows Claude's format: the imitation is
// completed here instead of being recognised downstream (see
// openspec/changes/an-agent-update-says-something/design.md).
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

import path from "node:path";
import type { SessionUpdate, ToolKind } from "@agentclientprotocol/sdk";
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

/** Where a translated update carries the Claude content block it came
 * from. ACP reserves `_meta` for exactly this and says a receiver must
 * assume nothing about it, so no surface reads it: it is there for a
 * person reading a run's JSON lines. The block, not the whole line — a
 * line with three blocks would otherwise carry itself three times. */
export const CLAUDE_STREAM_JSON_META_KEY = "openspec-ui/claude-stream-json";

const LINE_BREAK = String.fromCharCode(10);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/** The first line of a text, trimmed. With the multiline flag `$` matches
 * right before the first line break, so the split's first element is the
 * text up to it. */
function firstLine(text: string): string {
  return text.split(/$/m)[0]?.trim() ?? "";
}

/** A path as a title shows it: relative to the run's working directory
 * when it lies inside it, and with forward slashes on every platform, so a
 * run reads the same in a Windows terminal as in a log from Linux. */
function displayPath(filePath: string, cwd: string | undefined): string {
  let shown = filePath;
  if (cwd && path.isAbsolute(filePath)) {
    const relative = path.relative(cwd, filePath);
    const inside = relative.length > 0 && relative.split(path.sep)[0] !== ".." && !path.isAbsolute(relative);
    if (inside) shown = relative;
  }
  return shown.split(path.sep).join("/");
}

interface ClaudeToolDescription {
  title: string;
  kind: ToolKind;
  /** The file the tool acts on, as the tool was given it. */
  filePath?: string;
}

/** A tool use's ACP title and kind.
 *
 * A native ACP agent writes its own title. Claude's stream carries only
 * the tool's name and input, and this is the one place that knows which
 * input field names what a tool acts on. A known tool whose input lacks
 * that field is titled by its name and keeps its kind; a tool not listed
 * is titled by its name. See design.md, "the adapter writes the title". */
function describeClaudeToolUse(
  name: string,
  input: Record<string, unknown>,
  cwd: string | undefined,
): ClaudeToolDescription {
  const filePath = nonEmptyString(input.file_path) ?? nonEmptyString(input.notebook_path);
  const onFile = (kind: ToolKind): ClaudeToolDescription =>
    filePath ? { title: `${name} ${displayPath(filePath, cwd)}`, kind, filePath } : { title: name, kind };
  switch (name) {
    case "Read":
      return onFile("read");
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return onFile("edit");
    case "Bash":
    case "PowerShell": {
      const command = firstLine(nonEmptyString(input.command) ?? "");
      return { title: command ? `${name}: ${command}` : name, kind: "execute" };
    }
    case "Grep": {
      const pattern = nonEmptyString(input.pattern);
      const where = nonEmptyString(input.path);
      if (!pattern) return { title: name, kind: "search" };
      return { title: `Grep "${pattern}"${where ? ` in ${displayPath(where, cwd)}` : ""}`, kind: "search" };
    }
    case "Glob": {
      const pattern = nonEmptyString(input.pattern);
      return { title: pattern ? `Glob ${pattern}` : name, kind: "search" };
    }
    case "WebFetch": {
      const url = nonEmptyString(input.url);
      return { title: url ? `WebFetch ${url}` : name, kind: "fetch" };
    }
    case "WebSearch": {
      const query = nonEmptyString(input.query);
      return { title: query ? `WebSearch "${query}"` : name, kind: "fetch" };
    }
    case "Task":
    case "Agent": {
      const description = nonEmptyString(input.description);
      return { title: description ? `Agent: ${firstLine(description)}` : name, kind: "other" };
    }
    default:
      return { title: name, kind: "other" };
  }
}

/** What the stream has said so far that a later line needs: the run's
 * working directory, and each tool call's title, so the update reporting
 * its result can name it. */
interface ClaudeTranslationState {
  cwd: string | undefined;
  titles: Map<string, string>;
}

/** One content block's translation: an ACP update; `null` for a block
 * that was recognised and says nothing; `undefined` for a block this
 * adapter does not recognise. */
type BlockTranslation = SessionUpdate | null | undefined;

/** A message arrives whole rather than in slices — the adapter does not
 * ask for partial messages — so it ends its line: two messages in a row
 * must not be joined into one sentence that was never written. */
function endingItsLine(text: string): string {
  return text.endsWith(LINE_BREAK) ? text : `${text}${LINE_BREAK}`;
}

function translateAssistantBlock(block: Record<string, unknown>, state: ClaudeTranslationState): BlockTranslation {
  switch (block.type) {
    case "text":
      if (typeof block.text !== "string") return undefined;
      if (block.text.length === 0) return null;
      return { sessionUpdate: "agent_message_chunk", content: { type: "text", text: endingItsLine(block.text) } };
    case "thinking":
      // 2.1.237 sends thinking redacted: an empty text beside its
      // signature. There is nothing to show, so nothing is sent.
      if (typeof block.thinking !== "string") return undefined;
      if (block.thinking.length === 0) return null;
      return { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: endingItsLine(block.thinking) } };
    case "tool_use": {
      if (typeof block.id !== "string" || typeof block.name !== "string") return undefined;
      const described = describeClaudeToolUse(block.name, isRecord(block.input) ? block.input : {}, state.cwd);
      state.titles.set(block.id, described.title);
      // ACP's locations are absolute; a relative path is resolved against
      // the run's directory, and left out when there is none to resolve
      // against.
      const location =
        described.filePath === undefined
          ? undefined
          : state.cwd
            ? path.resolve(state.cwd, described.filePath)
            : path.isAbsolute(described.filePath)
              ? described.filePath
              : undefined;
      return {
        sessionUpdate: "tool_call",
        toolCallId: block.id,
        title: described.title,
        kind: described.kind,
        status: "in_progress",
        ...(location ? { locations: [{ path: location }] } : {}),
        rawInput: block.input,
      };
    }
    default:
      return undefined;
  }
}

function translateUserBlock(block: Record<string, unknown>, state: ClaudeTranslationState): BlockTranslation {
  if (block.type !== "tool_result" || typeof block.tool_use_id !== "string") return undefined;
  const title = state.titles.get(block.tool_use_id);
  return {
    sessionUpdate: "tool_call_update",
    toolCallId: block.tool_use_id,
    status: block.is_error === true ? "failed" : "completed",
    ...(title ? { title } : {}),
  };
}

/** One Claude stream-json line as ACP session updates, in the order of its
 * content blocks.
 *
 * `handled` is false when the line is left for the caller to forward as it
 * always was: a line with no content blocks (`system`, `result`,
 * `rate_limit_event`, ...), or one where nothing was translated and some
 * block was not recognised. A line whose every block was recognised and
 * said nothing — redacted thinking — is handled, with no updates. A block
 * not recognised beside blocks that were is skipped: per ADR 0017, what
 * parsed is kept and only what did not is dropped. */
function translateClaudeLine(
  parsed: Record<string, unknown>,
  state: ClaudeTranslationState,
): { handled: boolean; updates: Array<Record<string, unknown>> } {
  const content = isRecord(parsed.message) ? parsed.message.content : undefined;
  const translate =
    parsed.type === "assistant" ? translateAssistantBlock : parsed.type === "user" ? translateUserBlock : undefined;
  if (!translate || !Array.isArray(content) || content.length === 0) return { handled: false, updates: [] };

  const updates: Array<Record<string, unknown>> = [];
  let unrecognised = false;
  for (const block of content) {
    const translated = isRecord(block) ? translate(block, state) : undefined;
    if (translated === undefined) unrecognised = true;
    else if (translated !== null) updates.push({ ...translated, _meta: { [CLAUDE_STREAM_JSON_META_KEY]: block } });
  }
  return { handled: updates.length > 0 || !unrecognised, updates };
}

/** Translates `spawnAndStream`'s raw stdout stream — one JSON object per
 * line, per `claude`'s own `--output-format stream-json` — into
 * `agentUpdate` events, in ACP's own shapes wherever ACP has one (see
 * `translateClaudeLine`; `cwd` is what titles are made relative to),
 * buffering across chunk boundaries (a single
 * `stdout` event is not guaranteed to align with a line boundary). A line
 * that does not parse as JSON is passed through unchanged as `stdout` —
 * the same "conservative parsing" fallback shared.ts's own header
 * describes, applied one layer up: an unrecognized line degrades this
 * adapter to plain text for that one line, not to a broken event stream.
 * The final `"result"` line (if one arrives) determines whether the run's
 * own terminal event is `completed`/`failed` and its summary/reason —
 * more accurate than the underlying process's raw exit code alone, since
 * `claude -p` can exit 0 while `result.is_error` is true. */
export async function* translateClaudeStream(
  source: AsyncGenerator<Event>,
  runId: string,
  cwd?: string,
): AsyncGenerator<Event> {
  let buffer = "";
  let lastResult: ClaudeStreamResult | undefined;
  let lastUsage: AgentUsage | undefined;
  const state: ClaudeTranslationState = { cwd, titles: new Map() };

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
      const translated = translateClaudeLine(parsed, state);
      if (translated.handled) {
        for (const update of translated.updates) {
          yield { kind: "agentUpdate", runId, timestamp: nowIso(), update };
        }
        continue;
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
    // A custom agent the person defined themselves — same path
    // as the model, and only where the registry says this CLI
    // accepts one. See custom-agents-are-visible.
    if (command.customAgent) args.push("--agent", command.customAgent);
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
    yield* translateClaudeStream(rawStream, command.runId, command.cwd);
  }
}
