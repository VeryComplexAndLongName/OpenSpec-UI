// Running one change's chain from a terminal — ADR 0020.
//
// Wiring and presentation only. Every decision this makes was made in
// core: whether the chain may start at all (`resolveChainStart`), what
// the chain does (`HarnessChainRunner`), which agent runs a stage
// (`resolveRunner` over `buildDefaultAgentRunners`), and who may hold the
// workspace (`withWorkspaceLease`). What is genuinely this file's is
// asking a checkpoint on a terminal, turning the outcome into an exit
// code, and making Ctrl-C mean something.

import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  AgentStatusWriter,
  FileAuditLog,
  HarnessChainRunner,
  WorkspaceLeaseManager,
  auditLogPath,
  buildDefaultAgentRunners,
  createGitWrapper,
  readGitAuthor,
  readRepositoryAuditEntries,
  describeWorkspaceLeaseConflict,
  describeWorkspaceLeaseReclamation,
  reportEventsToAgentStatus,
  resolveAgentStatusDirectory,
  resolveChainStart,
  resolveRunner,
  withWorkspaceLease,
  type AgentRunner,
  type Command,
  type Event,
} from "@openspec-ui/core";
import { RunTextRenderer, renderRunEventAsJsonLine } from "./render-run.js";

/** How a checkpoint is put to somebody, and how their answer comes back.
 * Injected so the decision "is there anybody to ask" is made once, by the
 * caller, from the same fact `resolveChainStart` was given — rather than
 * read off `process.stdin` twice and possibly differently. */
export interface CheckpointPrompt {
  /** `undefined` when nobody can be asked. Its presence is what
   * `canAnswerCheckpoints` is derived from. */
  ask?: (question: string) => Promise<boolean>;
}

export interface RunChangeDeps {
  stdout: (text: string) => void;
  stderr: (line: string) => void;
  checkpoint: CheckpointPrompt;
  /** Test seam. Production passes nothing and gets the real registry,
   * the real audit log and the real lease. */
  createRunners?: (workspaceRoot: string, auditLog: FileAuditLog) => Map<string, AgentRunner>;
  createChainRunner?: (options: {
    resolveRunner: (agentId: string | undefined) => AgentRunner | undefined;
    listAuditEntries: () => ReturnType<FileAuditLog["readEntries"]>;
    auditLog: FileAuditLog;
  }) => Pick<HarnessChainRunner, "run" | "confirmCheckpoint" | "cancel">;
  /** Registers an interrupt handler and returns a function that removes
   * it. Injected because a unit test must not install a process-wide
   * signal handler. */
  onInterrupt?: (handler: () => void) => () => void;
}

export interface RunChangeOptions {
  workspaceRoot: string;
  changeName: string;
  format: "text" | "json";
}

/** The exit code, per ADR 0020 decision 7: `0` the chain completed, `1`
 * the change did not, `2` the CLI declined to start or could not. */
export async function runChange(options: RunChangeOptions, deps: RunChangeDeps): Promise<number> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const auditLog = new FileAuditLog(auditLogPath(workspaceRoot));
  const runners = deps.createRunners
    ? deps.createRunners(workspaceRoot, auditLog)
    : buildDefaultAgentRunners({ workspaceRoot, auditLog });
  const resolve = (agentId: string | undefined): AgentRunner | undefined => resolveRunner(runners, agentId);

  const start = await resolveChainStart({
    workspaceRoot,
    changeName: options.changeName,
    canAnswerCheckpoints: deps.checkpoint.ask !== undefined,
    resolveRunner: resolve,
  });
  if (!start.ok) {
    deps.stderr(`openspec-ui-cli: will not run "${options.changeName}": ${start.refusal.reason}`);
    if (start.refusal.configKey) {
      deps.stderr(`openspec-ui-cli: the setting that governs this is ${start.refusal.configKey}`);
    }
    return 2;
  }

  // Read once, here, and not in the heartbeat five seconds from now.
  const lease = new WorkspaceLeaseManager(workspaceRoot, {
    hostKind: "cli",
    author: await readGitAuthor(workspaceRoot),
  });
  const held = await withWorkspaceLease(lease, async (hold) => {
    if (hold.reclaimedFrom) deps.stderr(`openspec-ui-cli: ${describeWorkspaceLeaseReclamation(hold.reclaimedFrom)}`);
    return await driveChain(
      {
        workspaceRoot,
        changeDir: start.changeDir,
        format: options.format,
      },
      deps,
      (chainDeps) =>
        deps.createChainRunner
          ? deps.createChainRunner(chainDeps)
          : new HarnessChainRunner({
            resolveRunner: chainDeps.resolveRunner,
            listAuditEntries: chainDeps.listAuditEntries,
            auditLog: chainDeps.auditLog,
          }),
      { resolve, auditLog },
    );
  });

  if (!held.ok) {
    deps.stderr(`openspec-ui-cli: ${describeWorkspaceLeaseConflict(held.conflict)}`);
    return 2;
  }
  return held.value;
}

/** Drives the chain to a terminal event and reports what that event was.
 * Split out so the lease helper's body is one expression and every exit
 * from it — including a throw — releases the workspace. */
async function driveChain(
  run: { workspaceRoot: string; changeDir: string; format: "text" | "json" },
  deps: RunChangeDeps,
  makeChainRunner: NonNullable<RunChangeDeps["createChainRunner"]>,
  wiring: { resolve: (agentId: string | undefined) => AgentRunner | undefined; auditLog: FileAuditLog },
): Promise<number> {
  const runId = randomUUID();
  const chain = makeChainRunner({
    resolveRunner: wiring.resolve,
    // Summed across every working directory of the repository, not just
    // this one — ADR 0022 decision 5. Two changes running in two
    // worktrees share one budget; reading only this directory's log
    // would turn `budget.maxCostUsd` into a per-worktree allowance and
    // let three worktrees silently spend three times the ceiling.
    listAuditEntries: () =>
      readRepositoryAuditEntries({
        git: createGitWrapper({ cwd: run.workspaceRoot }),
        workspaceRoot: run.workspaceRoot,
      }),
    auditLog: wiring.auditLog,
  });

  const command: Command = {
    kind: "chain",
    cwd: run.workspaceRoot,
    runId,
    context: { changeDir: run.changeDir },
  };

  const changeName = path.basename(run.changeDir);
  const statusWriter = await startAgentStatusWriter(run.workspaceRoot, changeName);

  const renderer = new RunTextRenderer();
  const write = (event: Event): void => {
    if (run.format === "json") {
      deps.stdout(renderRunEventAsJsonLine(event));
      return;
    }
    const piece = renderer.render(event);
    if (piece !== undefined) deps.stdout(piece);
  };

  // A first interrupt cancels the chain, which terminates the agent's
  // process tree and lets the lease be released on the way out. A second
  // one gives up waiting: a shell that ignores Ctrl-C twice is worse than
  // a leaked child.
  let interrupted = false;
  const removeHandler = (deps.onInterrupt ?? defaultOnInterrupt)(() => {
    if (interrupted) {
      deps.stderr("\nopenspec-ui-cli: interrupted again — exiting without waiting for the agent to stop");
      process.exit(1);
    }
    interrupted = true;
    deps.stderr("\nopenspec-ui-cli: cancelling; press Ctrl-C again to exit at once");
    chain.cancel(runId);
  });

  let outcome: "completed" | "failed" | "cancelled" | "unterminated" = "unterminated";
  try {
    const chainEvents = statusWriter ? reportEventsToAgentStatus(chain.run(command), statusWriter) : chain.run(command);
    for await (const event of chainEvents) {
      write(event);

      if (event.kind === "checkpoint") {
        // `resolveChainStart` refused this run if nobody could be asked,
        // so an absent `ask` here would be a bug in that resolution
        // rather than a state to handle gracefully.
        const ask = deps.checkpoint.ask;
        if (!ask) throw new Error("a checkpoint was reached with no way to ask about it");
        const nextAgent = event.nextAgentId ? ` (${event.nextAgentId})` : "";
        const confirmed = await ask(`Continue to "${event.nextStage}"${nextAgent}?`);
        if (confirmed) chain.confirmCheckpoint(runId);
        else chain.cancel(runId);
        continue;
      }

      if (event.kind === "completed") outcome = "completed";
      else if (event.kind === "failed") outcome = "failed";
      else if (event.kind === "cancelled") outcome = "cancelled";
    }
  } finally {
    removeHandler();
    if (run.format === "text") {
      const tail = renderer.finish();
      if (tail !== undefined) deps.stdout(tail);
    }
  }

  if (outcome === "completed") return 0;
  if (outcome === "unterminated") {
    // The stream ended without saying how. Not a completion: a run whose
    // own account of itself is missing has not been shown to have worked,
    // and reporting success on silence is how a broken chain reads as a
    // green build.
    deps.stderr("openspec-ui-cli: the run ended without reporting an outcome");
    return 1;
  }
  return 1;
}

/** Best-effort: reporting progress must never be why a run fails. A
 * workspace this cannot resolve a status directory for (no git, an
 * unreadable settings file) still runs exactly as it did before this
 * existed — `undefined` here means the chain's events are streamed
 * unwrapped. */
async function startAgentStatusWriter(workspaceRoot: string, changeName: string): Promise<AgentStatusWriter | undefined> {
  try {
    const directory = await resolveAgentStatusDirectory(createGitWrapper({ cwd: workspaceRoot }), workspaceRoot);
    const writer = new AgentStatusWriter({ directory, workingDirectory: workspaceRoot, changeName });
    await writer.start(`starting "${changeName}"`);
    return writer;
  } catch {
    return undefined;
  }
}

function defaultOnInterrupt(handler: () => void): () => void {
  process.on("SIGINT", handler);
  return () => process.off("SIGINT", handler);
}
