// Where a Pipeline card's control goes in the editor
// (a-change-is-run-from-its-card). The pipeline panel has already checked
// that this host holds the run; this sends the control to what drives it.

import path from "node:path";
import type { AgentRunner, Command, HarnessChainRunner, LiveRuns } from "@openspec-ui/core";
import type { PipelineRunControl } from "./webview/pipeline-panel.js";

export interface PipelineRunControlDeps {
  liveRuns: Pick<LiveRuns, "get">;
  chainRunner: Pick<HarnessChainRunner, "holds" | "confirmCheckpoint" | "resolvePermission" | "asAgentRunner">;
  /** The runner a single-stage run was started on, by its agent. */
  resolveRunner: (agentId: string | undefined) => AgentRunner | undefined;
}

/** Sends a card's control to the run it names.
 *
 * A chain's checkpoint and permission are answered on the chain runner
 * itself, as the server's socket does. Its `asAgentRunner()` handles a
 * `cancel` and a `stop`, and passed a `confirmCheckpoint` on to `run()`,
 * which answered `failed` to nobody: the editor's Continue did nothing,
 * found by 7.6's live run. A chain's cancel and stop, and every control for
 * a single-stage run, go through a runner whose stream is drained here; the
 * run's own stream reports what follows. */
export function sendPipelineRunControl(control: PipelineRunControl, deps: PipelineRunControlDeps): void {
  const held = deps.liveRuns.get(control.runId);
  if (held === undefined) return;
  const command: Command = {
    kind: control.kind,
    cwd: held.cwd,
    runId: control.runId,
    context: { changeDir: path.join(held.cwd, "openspec", "changes", control.changeName) },
    ...(held.agentId !== undefined ? { agentId: held.agentId } : {}),
    ...(control.reason !== undefined ? { reason: control.reason } : {}),
    ...(control.permissionRequestId !== undefined ? { permissionRequestId: control.permissionRequestId } : {}),
    ...(control.permissionOutcome !== undefined ? { permissionOutcome: control.permissionOutcome } : {}),
  };

  const chain = deps.chainRunner.holds(control.runId);
  if (chain && control.kind === "confirmCheckpoint") {
    deps.chainRunner.confirmCheckpoint(control.runId);
    return;
  }
  if (chain && control.kind === "resolvePermission") {
    deps.chainRunner.resolvePermission(command);
    return;
  }

  const runner = chain ? deps.chainRunner.asAgentRunner() : deps.resolveRunner(held.agentId);
  if (runner === undefined) return;
  void (async () => {
    try {
      for await (const _event of runner.run(command)) {
        // Draining only: the run's own stream carries what follows.
      }
    } catch {
      // A runner that throws on a control must not become an unhandled
      // rejection.
    }
  })();
}
