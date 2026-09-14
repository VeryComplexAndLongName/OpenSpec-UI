// What a host does when its run reads a request to stop it — the host decides
// how its run stops (a-run-elsewhere-can-be-asked-to-stop).
//
// Every host passes one of these to `withAgentStatus`, so the stop a request
// makes is exactly the one a card asks of a run on its own host, and a
// request the run refuses is recorded the same way wherever the run is. Kept
// in core so no host carries its own copy.

import type { AgentStatusRunOptions, AgentStatusStopRequestRefusal } from "./agent-status.js";
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
