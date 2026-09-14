// What a host does when its run reads a request to stop it — the host decides
// how its run stops (a-run-elsewhere-can-be-asked-to-stop).
//
// Every host passes one of these to `withAgentStatus`, so the stop a request
// makes is exactly the one a card asks of a run on its own host, and a
// request the run refuses is recorded the same way wherever the run is. Kept
// in core so no host carries its own copy.

import os from "node:os";

import { askRunToStop, messageDirectoryBeside } from "./agent-messages.js";
import { readAgentStatuses, type AgentStatusRunOptions, type AgentStatusStopRequestRefusal } from "./agent-status.js";
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
  chainRunner: { requestStop(runId: string, reason: string, by?: string, messageId?: string): boolean },
  command: RunCommand,
  auditLog?: AuditLog,
): StopRequestHandlers {
  return {
    onStopRequested: (request) => {
      chainRunner.requestStop(command.runId, request.reason, request.by, request.messageId);
    },
    onStopRequestRefused: (refusal) => recordRefusal(auditLog, command, "chain", refusal),
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
  /** Test seams. */
  read?: typeof readAgentStatuses;
  ask?: typeof askRunToStop;
  loadKey?: () => Promise<MachineKey>;
  readAuthor?: (cwd: string) => Promise<string | undefined>;
  machine?: string;
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
  const key = await (options.loadKey ?? (() => loadOrCreateMachineKey()))();
  const gitAuthor = await (options.readAuthor ?? readGitAuthor)(options.workspaceRoot).catch(() => undefined);
  const messageId = await (options.ask ?? askRunToStop)({
    directory: messageDirectoryBeside(options.statusDirectory),
    to: options.instanceId,
    reason,
    key,
    machine: options.machine ?? os.hostname(),
    ...(gitAuthor !== undefined ? { gitAuthor } : {}),
  });
  return { asked: true, messageId };
}
