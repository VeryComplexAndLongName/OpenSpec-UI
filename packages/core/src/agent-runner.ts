// AgentRunner — a single abstraction for running a CLI agent (or a local
// LLM over HTTP), hiding the differences between Claude CLI/Copilot
// CLI/Codex CLI/Gemini CLI/local LLM behind adapters (see design.md,
// "AgentRunner — a single-method interface run(command, cwd, context) →
// AsyncIterable<Event>").
//
// Security checks (allowlist, cwd sandbox) and the audit log run here,
// inline, BEFORE delegating to a specific adapter — no adapter is ever
// invoked if a check fails (see security.ts).

import {
  type AllowlistConfig,
  type AuditLog,
  checkAllowlist,
  checkCwdSandbox,
  prepareAgentContext,
} from "./security.js";
import type { Command, Event } from "./protocol.js";

export type AdapterInvocation =
  | { kind: "process"; executable: string; args: string[] }
  | { kind: "http"; url: string; method: string };

export interface AgentAdapter {
  /** The agent's name, as it appears in the workspace's allowlist config. */
  readonly name: string;
  /** Builds a description of what would be run, for the allowlist check.
   * Has no side effects (does not spawn a process or make an HTTP request). */
  buildInvocation(command: Command): AdapterInvocation;
  /** Executes an already-validated run and streams protocol events.
   * Only called after the allowlist/cwd checks have passed.
   * `prompt` is the result of prepareAgentContext (data, not an instruction).
   * `signal` aborts when a `"cancel"` command names this run — every
   * adapter forwards it to whatever it uses to reach the agent (a spawned
   * process's `spawnAndStream`, or an HTTP request), or it is a silently
   * non-cancellable agent. */
  execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event>;
}

export interface AgentRunnerOptions {
  workspaceRoot: string;
  allowlist: AllowlistConfig;
  auditLog: AuditLog;
  allowExternalCwd?: boolean;
  /** Best-effort version of the agent CLI this runner drives, as observed
   * by detection (see agent-detection.ts's `DetectedAgent`). Recorded on
   * every run's `"started"` audit entry when given — never fetched here:
   * calling `detectAvailableAgents()` from inside a run would add a
   * second spawn ADR 0017 decision 6 already rejects. Absent means no
   * version is recorded, exactly as before this option existed. */
  agentVersion?: string;
}

export interface AgentRunner {
  run(command: Command): AsyncIterable<Event>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function* failedOnce(runId: string, reason: string): Iterable<Event> {
  yield { kind: "failed", runId, timestamp: nowIso(), reason };
}

export function createAgentRunner(adapter: AgentAdapter, options: AgentRunnerOptions): AgentRunner {
  const { workspaceRoot, allowlist, auditLog, allowExternalCwd = false, agentVersion } = options;
  // One entry per run this runner itself started, from just before
  // `adapter.execute()` is called until that run's own `finally` below
  // deletes it. A `"cancel"` command never builds an invocation or spawns
  // anything — it only ever looks a `runId` up here and aborts it.
  const activeRuns = new Map<string, AbortController>();

  return {
    async *run(command: Command): AsyncIterable<Event> {
      if (command.kind === "cancel") {
        // Unknown runId (already finished, already cancelled, or never
        // started here) is not an error — the run may have ended between
        // the click and the command's arrival (design.md, "Cancelling an
        // unknown runId is not an error").
        activeRuns.get(command.runId)?.abort();
        yield { kind: "cancelled", runId: command.runId, timestamp: nowIso() };
        return;
      }

      const cwdDecision = checkCwdSandbox(command.cwd, workspaceRoot, { allowExternalCwd });
      if (!cwdDecision.allowed) {
        auditLog.record({
          runId: command.runId,
          agent: adapter.name,
          outcome: "blocked",
          cwd: command.cwd,
          timestamp: nowIso(),
          changeDir: command.context.changeDir,
          reason: cwdDecision.reason,
        });
        yield* failedOnce(command.runId, cwdDecision.reason ?? "cwd is outside the workspace");
        return;
      }

      const invocation = adapter.buildInvocation(command);
      const allowlistDecision = checkAllowlist(adapter.name, invocation, allowlist);
      if (!allowlistDecision.allowed) {
        auditLog.record({
          runId: command.runId,
          agent: adapter.name,
          outcome: "blocked",
          cwd: command.cwd,
          timestamp: nowIso(),
          changeDir: command.context.changeDir,
          invocation,
          reason: allowlistDecision.reason,
        });
        yield* failedOnce(command.runId, allowlistDecision.reason ?? "command not permitted by the allowlist");
        return;
      }

      const { prompt } = await prepareAgentContext(command.context, {
        kind: command.kind,
        cwd: command.cwd,
        verifiedDelta: command.context.verifiedDelta,
      });

      auditLog.record({
        runId: command.runId,
        agent: adapter.name,
        outcome: "started",
        cwd: command.cwd,
        timestamp: nowIso(),
        changeDir: command.context.changeDir,
        invocation,
        ...(agentVersion !== undefined ? { agentVersion } : {}),
      });

      const controller = new AbortController();
      activeRuns.set(command.runId, controller);

      let lastOutcome: "completed" | "failed" | "cancelled" = "completed";
      let lastSummary: string | undefined;
      let lastReason: string | undefined;
      try {
        for await (const event of adapter.execute(invocation, command, prompt, controller.signal)) {
          if (event.kind === "completed") lastSummary = event.summary;
          if (event.kind === "failed") {
            lastOutcome = "failed";
            lastReason = event.reason;
          }
          if (event.kind === "cancelled") lastOutcome = "cancelled";
          yield event;
        }
      } catch (err) {
        lastOutcome = "failed";
        lastReason = err instanceof Error ? err.message : String(err);
        yield { kind: "failed", runId: command.runId, timestamp: nowIso(), reason: lastReason };
      } finally {
        activeRuns.delete(command.runId);
        auditLog.record({
          runId: command.runId,
          agent: adapter.name,
          outcome: lastOutcome,
          cwd: command.cwd,
          timestamp: nowIso(),
          changeDir: command.context.changeDir,
          invocation,
          reason: lastReason,
          summary: lastSummary,
        });
      }
    },
  };
}
