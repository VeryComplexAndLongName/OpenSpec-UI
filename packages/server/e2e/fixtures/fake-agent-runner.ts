import type { AgentRunner, Command, Event } from "@openspec-ui/core";

// Register under DEFAULT_AGENT_ID ("claude-cli", packages/core/src/agents/
// registry.ts) so the AI panel's default agent selection and its
// undefined-agentId fallback for status/list/show/validate (resolveRunner
// -> DEFAULT_AGENT_ID, packages/core/src/default-runners.ts) both resolve
// to this one fake runner — no agent-picker interaction needed in tests.

function nowIso(): string {
  return new Date().toISOString();
}

export interface FakeAgentRunnerOptions {
  /** Change name reported for a "list" command, so the AI panel's change
   * picker (parseChangeNamesFromStdout in AiPanel.tsx) populates for real. */
  changeName: string;
  /** Resolves when the `implement` run's `completed` event should be
   * emitted -- lets a test inspect mid-run state (an active lease, a
   * killed server, a dropped connection) before the run finishes.
   * Defaults to an already-resolved promise (run completes immediately). */
  implementGate?: Promise<void>;
}

export function createFakeAgentRunner(options: FakeAgentRunnerOptions): AgentRunner {
  const { changeName, implementGate = Promise.resolve() } = options;

  return {
    async *run(command: Command): AsyncIterable<Event> {
      if (command.kind === "implement") {
        yield { kind: "started", runId: command.runId, timestamp: nowIso(), command: command.kind, cwd: command.cwd };
        yield { kind: "progress", runId: command.runId, timestamp: nowIso(), message: "applying changes" };
        yield { kind: "stdout", runId: command.runId, timestamp: nowIso(), chunk: "updated proposal.md\n" };
        await implementGate;
        yield { kind: "completed", runId: command.runId, timestamp: nowIso(), summary: "1 file changed" };
        return;
      }

      // list/status/show/validate: one stdout carrying the change list
      // (the only payload shape any of these specs' AI panel flows need),
      // then a plain completion.
      yield {
        kind: "stdout",
        runId: command.runId,
        timestamp: nowIso(),
        chunk: JSON.stringify({ changes: [{ name: changeName }] }),
      };
      yield { kind: "completed", runId: command.runId, timestamp: nowIso() };
    },
  };
}
