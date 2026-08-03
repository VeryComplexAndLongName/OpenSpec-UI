// AgentRunner — единая абстракция запуска CLI-агента (или локальной LLM по
// HTTP), скрывающая различия между Claude CLI/Copilot CLI/Codex CLI/Gemini
// CLI/локальной LLM за адаптерами (см. design.md, "AgentRunner — интерфейс
// с одним методом run(command, cwd, context) → AsyncIterable<Event>").
//
// Security-проверки (allowlist, cwd-sandbox) и аудит-лог выполняются здесь,
// inline, ДО делегирования конкретному адаптеру — ни один адаптер не
// вызывается, если проверка не пройдена (см. security.ts).

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
  /** Имя агента, под которым он фигурирует в allowlist-конфиге воркспейса. */
  readonly name: string;
  /** Строит описание того, что было бы запущено, для проверки allowlist'ом.
   * Не выполняет побочных эффектов (не спавнит процесс, не делает HTTP-запрос). */
  buildInvocation(command: Command): AdapterInvocation;
  /** Выполняет уже провалидированный запуск и стримит события протокола.
   * Вызывается только после успешного прохождения allowlist/cwd-проверок.
   * `prompt` — результат prepareAgentContext (данные, не инструкция). */
  execute(invocation: AdapterInvocation, command: Command, prompt: string): AsyncIterable<Event>;
}

export interface AgentRunnerOptions {
  workspaceRoot: string;
  allowlist: AllowlistConfig;
  auditLog: AuditLog;
  allowExternalCwd?: boolean;
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
  const { workspaceRoot, allowlist, auditLog, allowExternalCwd = false } = options;

  return {
    async *run(command: Command): AsyncIterable<Event> {
      const cwdDecision = checkCwdSandbox(command.cwd, workspaceRoot, { allowExternalCwd });
      if (!cwdDecision.allowed) {
        auditLog.record({
          runId: command.runId,
          agent: adapter.name,
          outcome: "blocked",
          cwd: command.cwd,
          timestamp: nowIso(),
          reason: cwdDecision.reason,
        });
        yield* failedOnce(command.runId, cwdDecision.reason ?? "cwd вне воркспейса");
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
          invocation,
          reason: allowlistDecision.reason,
        });
        yield* failedOnce(command.runId, allowlistDecision.reason ?? "команда не разрешена allowlist'ом");
        return;
      }

      const { prompt } = prepareAgentContext(command.context);

      auditLog.record({
        runId: command.runId,
        agent: adapter.name,
        outcome: "started",
        cwd: command.cwd,
        timestamp: nowIso(),
        invocation,
      });

      let lastOutcome: "completed" | "failed" | "cancelled" = "completed";
      let lastSummary: string | undefined;
      let lastReason: string | undefined;
      try {
        for await (const event of adapter.execute(invocation, command, prompt)) {
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
        auditLog.record({
          runId: command.runId,
          agent: adapter.name,
          outcome: lastOutcome,
          cwd: command.cwd,
          timestamp: nowIso(),
          invocation,
          reason: lastReason,
          summary: lastSummary,
        });
      }
    },
  };
}
