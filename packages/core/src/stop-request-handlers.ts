// What a host does when its run reads a request to stop it — the host decides
// how its run stops (a-run-elsewhere-can-be-asked-to-stop).
//
// Every host passes one of these to `withAgentStatus`, so the stop a request
// makes is exactly the one a card asks of a run on its own host, and a
// request the run refuses is recorded the same way wherever the run is. Kept
// in core so no host carries its own copy.

import os from "node:os";

import {
  askRunToStop,
  isTaskNumber,
  messageDirectoryBeside,
  sendMessage,
  type ConversationKind,
} from "./agent-messages.js";
import {
  readAgentStatuses,
  type AgentStatusMessage,
  type AgentStatusMessageRefusal,
  type AgentStatusRunOptions,
  type AgentStatusStopRequestRefusal,
} from "./agent-status.js";
import type { ChainAnswer, ChainMessage } from "./harness-chain-runner.js";
import { readGitAuthor } from "./git.js";
import { loadOrCreateMachineKey, type MachineKey } from "./machine-key.js";
import type { Command, Event } from "./protocol.js";
import type { AuditLog } from "./security.js";

type StopRequestHandlers = Pick<AgentStatusRunOptions, "onStopRequested" | "onStopRequestRefused">;

/** The command a run was started with, as far as a stop needs it. */
type RunCommand = Pick<Command, "runId" | "cwd" | "context">;

/** Records a request the run did not act on, beside its other entries. */
function recordRefusal(auditLog: AuditLog | undefined, command: RunCommand, agent: string, refusal: AgentStatusStopRequestRefusal): void {
  auditLog?.record({
    runId: command.runId,
    agent,
    outcome: "message",
    cwd: command.cwd,
    timestamp: new Date().toISOString(),
    changeDir: command.context.changeDir,
    stopRequestRefused: { messageId: refusal.messageId, why: refusal.why },
  });
}

/** For a chain: the request becomes the chain runner's own requestStop, with
 * the enrolled person as `by` and the request's message id, which the chain's
 * ending entry carries. */
export function chainStopRequestHandlers(
  chainRunner: { requestStop(runId: string, reason: string, by?: string, messageId?: string, afterTask?: string): boolean },
  command: RunCommand,
  auditLog?: AuditLog,
): StopRequestHandlers {
  return {
    onStopRequested: (request) => {
      chainRunner.requestStop(command.runId, request.reason, request.by, request.messageId, request.afterTask);
    },
    onStopRequestRefused: (refusal) => recordRefusal(auditLog, command, "chain", refusal),
  };
}

type MessageHandlers = Pick<AgentStatusRunOptions, "onMessage" | "onMessageRefused">;

/** For a chain: a note or a question is held for the next stage, and the
 * audit records that the run was spoken to and by whom
 * (the-operator-can-say-something-to-a-run).
 *
 * An answer is not written here. The chain writes it when the stage that
 * carried the question ends, through the `answerMessage` dependency its
 * host passes in: only then is there anything to say. */
export function chainMessageHandlers(
  chainRunner: { deliverMessage(runId: string, message: ChainMessage): boolean },
  command: RunCommand,
  auditLog?: AuditLog,
): MessageHandlers {
  return {
    onMessage: (message: AgentStatusMessage) => {
      if (message.kind === "answer") return;
      chainRunner.deliverMessage(command.runId, {
        messageId: message.messageId,
        kind: message.kind,
        words: message.words,
        from: message.from,
        fromKeyId: message.fromKeyId,
        sentAt: message.sentAt,
      });
    },
    onMessageRefused: (refusal: AgentStatusMessageRefusal) => recordMessageRefusal(auditLog, command, "chain", refusal),
  };
}

/** Records a message the run did not take, beside its other entries. What
 * was said is not repeated: it was not verified to be anybody's. */
function recordMessageRefusal(
  auditLog: AuditLog | undefined,
  command: RunCommand,
  agent: string,
  refusal: AgentStatusMessageRefusal,
): void {
  auditLog?.record({
    runId: command.runId,
    agent,
    outcome: "message",
    cwd: command.cwd,
    timestamp: new Date().toISOString(),
    changeDir: command.context.changeDir,
    operatorMessageRefused: { messageId: refusal.messageId, why: refusal.why },
  });
}

/** Writes the answers a chain owes, sealed with this machine's key.
 *
 * Passed to the chain runner as `answerMessage`. The chain decides what to
 * say and when; this knows where the key is. */
export function chainAnswerWriter(options: {
  /** Where the run's status records live. A function, because a host
   * builds its chain runner long before it knows the directory: resolving
   * it needs git. */
  statusDirectory: string | (() => Promise<string>);
  workspaceRoot: string;
  loadKey?: () => Promise<MachineKey>;
  readAuthor?: (cwd: string) => Promise<string | undefined>;
  machine?: string;
  send?: typeof sendMessage;
}): (answer: ChainAnswer) => Promise<void> {
  return async (answer: ChainAnswer) => {
    const statusDirectory = typeof options.statusDirectory === "string"
      ? options.statusDirectory
      : await options.statusDirectory();
    const key = await (options.loadKey ?? (() => loadOrCreateMachineKey()))();
    const gitAuthor = await (options.readAuthor ?? readGitAuthor)(options.workspaceRoot).catch(() => undefined);
    await (options.send ?? sendMessage)({
      directory: messageDirectoryBeside(statusDirectory),
      to: answer.to,
      toKind: "person",
      kind: "answer",
      author: "run",
      words: answer.words,
      answers: answer.answers,
      stage: answer.stage,
      runId: answer.runId,
      key,
      machine: options.machine ?? os.hostname(),
      ...(gitAuthor !== undefined ? { gitAuthor } : {}),
    });
  };
}

/** For a single-stage run: the request becomes a `stop` command to the
 * runner that holds the run, whose own stream reports what follows. */
export function agentStopRequestHandlers(
  runner: { run(command: Command): AsyncIterable<Event> },
  command: Command,
  auditLog?: AuditLog,
): StopRequestHandlers {
  return {
    onStopRequested: (request) => {
      void (async () => {
        try {
          for await (const _event of runner.run({ ...command, kind: "stop", reason: request.reason })) {
            // Draining only: the run's own stream carries the stop.
          }
        } catch {
          // A runner that throws on a stop must not become an unhandled
          // rejection; the run goes on and can be asked again.
        }
      })();
    },
    onStopRequestRefused: (refusal) => recordRefusal(auditLog, command, command.agentId ?? "agent", refusal),
  };
}

export type AskLiveRunToStopResult = { asked: true; messageId: string } | { asked: false; why: string };

export interface AskLiveRunToStopOptions {
  /** The status directory the host has just read the live runs from. */
  statusDirectory: string;
  workspaceRoot: string;
  instanceId: string;
  reason: string;
  /** The task the run may finish before it stops, as `tasks.md` numbers
   * it (a-run-is-told-where-to-stop). */
  afterTask?: string;
  /** Test seams. */
  read?: typeof readAgentStatuses;
  ask?: typeof askRunToStop;
  loadKey?: () => Promise<MachineKey>;
  readAuthor?: (cwd: string) => Promise<string | undefined>;
  machine?: string;
}

export type SayToLiveRunResult = { sent: true; messageId: string } | { sent: false; why: string };

export interface SayToLiveRunOptions {
  /** The status directory the host has just read the live runs from. */
  statusDirectory: string;
  workspaceRoot: string;
  instanceId: string;
  /** A note expects no reply; a question is answered when the stage that
   * carries it ends. */
  kind: "note" | "ask";
  words: string;
  /** Test seams. */
  read?: typeof readAgentStatuses;
  send?: typeof sendMessage;
  loadKey?: () => Promise<MachineKey>;
  readAuthor?: (cwd: string) => Promise<string | undefined>;
  machine?: string;
}

/** The speaking side, for a host's row or card: a note or a question,
 * written only for a run the host reads as live now, and sealed with the
 * host's own key. Any other instance is refused, and says why - the same
 * rule `askLiveRunToStop` applies, for the same reason: a run that is gone
 * reads nothing, so a message to it would sit unread and look delivered
 * (the-operator-can-say-something-to-a-run). */
export async function sayToLiveRun(options: SayToLiveRunOptions): Promise<SayToLiveRunResult> {
  const words = options.words.trim();
  if (words.length === 0) return { sent: false, why: "a message with no words says nothing" };
  const { reports } = await (options.read ?? readAgentStatuses)(options.statusDirectory);
  const live = reports.some((report) => report.instanceId === options.instanceId && !report.gone && report.signature !== "does-not-check-out");
  if (!live) return { sent: false, why: `no live run reports itself as ${options.instanceId}` };
  const key = await (options.loadKey ?? (() => loadOrCreateMachineKey()))();
  const gitAuthor = await (options.readAuthor ?? readGitAuthor)(options.workspaceRoot).catch(() => undefined);
  const messageId = await (options.send ?? sendMessage)({
    directory: messageDirectoryBeside(options.statusDirectory),
    to: options.instanceId,
    toKind: "run",
    kind: options.kind satisfies ConversationKind,
    author: "person",
    words,
    key,
    machine: options.machine ?? os.hostname(),
    ...(gitAuthor !== undefined ? { gitAuthor } : {}),
  });
  return { sent: true, messageId };
}

/** The asking side, for a host's card: a request to stop, written only for a
 * run the host reads as live now, and sealed with the host's own key. Any
 * other instance is refused, and says why. Both the standalone server's route
 * and the editor's Pipeline panel call this, so neither carries its own check
 * (a-run-elsewhere-can-be-asked-to-stop). */
export async function askLiveRunToStop(options: AskLiveRunToStopOptions): Promise<AskLiveRunToStopResult> {
  const reason = options.reason.trim();
  if (reason.length === 0) return { asked: false, why: "a stop needs a reason" };
  const { reports } = await (options.read ?? readAgentStatuses)(options.statusDirectory);
  // A record that does not check out names no run, and a gone run reads no
  // requests: neither is one a card could ask.
  const live = reports.some((report) => report.instanceId === options.instanceId && !report.gone && report.signature !== "does-not-check-out");
  if (!live) return { asked: false, why: `no live run reports itself as ${options.instanceId}` };
  const afterTask = options.afterTask?.trim();
  if (options.afterTask !== undefined && (afterTask === undefined || !isTaskNumber(afterTask))) {
    return { asked: false, why: `${JSON.stringify(options.afterTask)} is not a task number, such as 4.6` };
  }
  const key = await (options.loadKey ?? (() => loadOrCreateMachineKey()))();
  const gitAuthor = await (options.readAuthor ?? readGitAuthor)(options.workspaceRoot).catch(() => undefined);
  const messageId = await (options.ask ?? askRunToStop)({
    directory: messageDirectoryBeside(options.statusDirectory),
    to: options.instanceId,
    reason,
    ...(afterTask !== undefined ? { afterTask } : {}),
    key,
    machine: options.machine ?? os.hostname(),
    ...(gitAuthor !== undefined ? { gitAuthor } : {}),
  });
  return { asked: true, messageId };
}
