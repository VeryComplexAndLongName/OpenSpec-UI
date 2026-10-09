// Updating a change's plan from a terminal - the-plan-is-updated-from-its-review,
// ADR 0041.
//
// Wiring and presentation only, as run-change.ts is: the update's prompt
// (the last review, the notes) is built in core, the runner is core's, and
// the workspace is held by core's lease. What is this file's is choosing the
// agent - `--agent`, else the change's review stage - and printing the run.

import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  FileAuditLog,
  WorkspaceLeaseManager,
  auditLogPath,
  buildDefaultAgentRunners,
  createFileRunLogs,
  describeWorkspaceLeaseConflict,
  normalizeStepAgent,
  readGitAuthor,
  resolveHarnessConfig,
  resolveRunner,
  withAgentStatus,
  withWorkspaceLease,
  type AgentRunner,
  type Command,
  formatMessage,
  say,
} from "@openspec-ui/core";
import { RunTextRenderer, renderRunEventAsJsonLine } from "./render-run.js";
import type { CheckpointPrompt } from "./run-change.js";

export interface UpdatePlanOptions {
  workspaceRoot: string;
  changeName: string;
  note?: string;
  agent?: string;
  format: "text" | "json";
}

export interface UpdatePlanDeps {
  stdout: (text: string) => void;
  stderr: (line: string) => void;
  /** How an agent's permission request is put to the person at the
   * terminal - the prompt `run` puts a checkpoint with. Where nobody can be
   * asked, the request is denied and the agent goes on without it; left
   * unanswered, an ACP agent would wait for ever. */
  permission?: CheckpointPrompt;
  /** Test seam: the real registry where absent. */
  createRunners?: (workspaceRoot: string, auditLog: FileAuditLog) => Map<string, AgentRunner>;
}

/** `0` the update completed, `1` it did not, `2` it could not start. */
export async function updatePlan(options: UpdatePlanOptions, deps: UpdatePlanDeps): Promise<number> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const changeDir = path.join(workspaceRoot, "openspec", "changes", options.changeName);
  const exists = await stat(changeDir).then((found) => found.isDirectory(), () => false);
  if (!exists) {
    deps.stderr(`openspec-ui-cli: "${options.changeName}" is not an active change of ${workspaceRoot}`);
    return 2;
  }
  // The update revises what its review asked for, so it runs on the review
  // stage's agent unless told otherwise (ADR 0041).
  const config = await resolveHarnessConfig(workspaceRoot, options.changeName).catch(() => undefined);
  const reviewEntry = config?.stepAgents.review;
  const agentId = options.agent ?? (reviewEntry === undefined ? undefined : normalizeStepAgent(reviewEntry).agent);

  const auditLog = new FileAuditLog(auditLogPath(workspaceRoot));
  const runners = deps.createRunners
    ? deps.createRunners(workspaceRoot, auditLog)
    : buildDefaultAgentRunners({ workspaceRoot, auditLog, runLogs: createFileRunLogs(workspaceRoot) });
  const runner = resolveRunner(runners, agentId);
  if (runner === undefined) {
    deps.stderr(`openspec-ui-cli: no agent "${agentId ?? "(default)"}" to run the update`);
    return 2;
  }

  const command: Command = {
    kind: "update",
    cwd: workspaceRoot,
    runId: randomUUID(),
    ...(agentId !== undefined ? { agentId } : {}),
    context: {
      changeDir,
      ...(options.note !== undefined && options.note.trim().length > 0 ? { notes: options.note.trim() } : {}),
    },
  };

  const lease = new WorkspaceLeaseManager(workspaceRoot, { hostKind: "cli", author: await readGitAuthor(workspaceRoot) });
  const held = await withWorkspaceLease(lease, async () => {
    const renderer = new RunTextRenderer();
    let outcome: "completed" | "failed" | "cancelled" | "unterminated" = "unterminated";
    for await (const event of withAgentStatus(runner.run(command), command, {})) {
      if (options.format === "json") deps.stdout(renderRunEventAsJsonLine(event));
      else {
        const piece = renderer.render(event);
        if (piece !== undefined) deps.stdout(piece);
      }
      if (event.kind === "permissionRequest") {
        const ask = deps.permission?.ask;
        const allowed = ask !== undefined ? await ask(`The agent asks: ${event.description}. Allow?`) : false;
        if (ask === undefined) deps.stderr(formatMessage(say("OSW-PRM-102", { request: event.description })));
        for await (const _answered of runner.run({
          ...command,
          kind: "resolvePermission",
          permissionRequestId: event.requestId,
          permissionOutcome: allowed ? "allow" : "deny",
        })) {
          // Draining only: answering prints nothing of its own.
        }
      }
      if (event.kind === "completed") outcome = "completed";
      else if (event.kind === "failed") outcome = "failed";
      else if (event.kind === "cancelled") outcome = "cancelled";
    }
    if (options.format === "text") {
      const tail = renderer.finish();
      if (tail !== undefined) deps.stdout(tail);
    }
    return outcome === "completed" ? 0 : 1;
  });
  if (!held.ok) {
    deps.stderr(`openspec-ui-cli: ${describeWorkspaceLeaseConflict(held.conflict)}`);
    return 2;
  }
  return held.value;
}
