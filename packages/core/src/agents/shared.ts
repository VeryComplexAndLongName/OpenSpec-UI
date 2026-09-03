// Shared helper for CLI adapters based on a child process (all of them
// except the local LLM, which works over HTTP — see local-llm.ts).
//
// Conservative parsing: the agent's output is passed through line-by-line
// as-is into a `stdout`/`stderr` event, with no attempt to guess a
// structured format. If a CLI version changes its output format, the
// event stream does not break — it simply does not produce `progress`,
// only `stdout` (see spec.md, "Unexpected agent output format").
//
// `cross-spawn` rather than plain `node:child_process.spawn`: on Windows
// many CLIs (including `copilot`) are installed as `.cmd` shims, which
// `spawn(executable, args)` cannot find without `shell: true` (`ENOENT`) —
// see openspec/changes/standalone-app/tasks.md 3.1, live smoke test.
// Enabling `shell: true` directly would be unsafe: the prompt (data from
// change-file content) is passed to some adapters as an argv argument, and
// plain `shell: true` would be a direct shell injection through that
// argument. `cross-spawn` specifically solves `.cmd`/`.bat` resolution on
// Windows, escaping each argument individually rather than interpreting
// the resulting command line in a shell.
import crossSpawn from "cross-spawn";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { CommandKind, Event } from "../protocol.js";

/** Ten seconds. Terminating a tree that can be terminated takes
 * milliseconds, so this is not a budget for the normal case — it is how
 * long to wait before admitting the process outlived the request. */
export const KILL_CONFIRMATION_TIMEOUT_MS = 10_000;

function nowIso(): string {
  return new Date().toISOString();
}

export interface SpawnAndStreamOptions {
  executable: string;
  args: string[];
  cwd: string;
  runId: string;
  commandKind: CommandKind;
  /** Written to the process's stdin (e.g. the prompt for CLIs that read it from stdin). */
  stdin?: string;
  /** Optional — an adapter that does not pass one behaves exactly as
   * before this option existed. When given and it aborts, the spawned
   * process tree is terminated and the stream ends with `cancelled`. */
  signal?: AbortSignal;
  /** How long to wait for the process to actually exit after termination
   * was requested, before reporting that it outlived the request.
   * Defaults to `KILL_CONFIRMATION_TIMEOUT_MS`; overridable so a test can
   * exercise the survived-the-kill path without waiting ten seconds — a
   * constant a test cannot reach is a path a test does not cover. */
  killConfirmationTimeoutMs?: number;
}

export interface TerminationOutcome {
  /** Whether the kill could be issued at all. `false` means the caller
   * never got as far as asking the operating system — a different
   * situation from "asked and the process survived", and one the user can
   * act on differently. Neither is a promise that the process died: only
   * its own exit says that. */
  attempted: boolean;
  reason?: string;
}

/** Terminates the process tree rooted at `pid`, not only that one process.
 * `cross-spawn` resolves a `.cmd` shim (e.g. `copilot` on Windows) through
 * `cmd.exe` — killing only the direct child would kill the shim and leave
 * the real agent process running (see this file's header comment and
 * design.md, "Termination kills the process tree"). Exported for reuse by
 * acp-session-driver.ts, whose ACP-flavored adapters spawn the same kind
 * of `.cmd`-shimmed processes but stream over ACP JSON-RPC instead of
 * this module's own spawnAndStream.
 *
 * Never rejects: callers use it in cleanup paths where a tidy-up failure
 * must not become the run's outcome. It reports the outcome instead, which
 * is what the previous version discarded — a swallowed `taskkill` error
 * was how a failed kill could be reported to the user as a successful
 * cancellation. */
export function terminateProcessTree(pid: number): Promise<TerminationOutcome> {
  if (process.platform === "win32") {
    return new Promise<TerminationOutcome>((resolve) => {
      const killer = crossSpawn("taskkill", ["/T", "/F", "/PID", String(pid)], { stdio: "ignore" });
      killer.on("error", (error) => {
        // No further fallback reaches a .cmd shim's real descendant — but
        // that is a reason to report it, not to discard it.
        resolve({ attempted: false, reason: `taskkill could not be started: ${error.message}` });
      });
      killer.on("close", (code) => {
        // A non-zero taskkill usually means the process was already gone
        // (128) — which is success from this function's point of view,
        // since the caller only needs to know the request was issued.
        resolve({ attempted: true, reason: code === 0 ? undefined : `taskkill exited with code ${code ?? "unknown"}` });
      });
    });
  }
  try {
    process.kill(-pid, "SIGKILL");
    return Promise.resolve({ attempted: true });
  } catch (groupError) {
    try {
      process.kill(pid, "SIGKILL");
      return Promise.resolve({ attempted: true });
    } catch (error) {
      // ESRCH means the process is already gone, which is the outcome the
      // caller wanted — not a failure to report as one.
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code === "ESRCH") return Promise.resolve({ attempted: true });
      const message = error instanceof Error ? error.message : String(error);
      const groupMessage = groupError instanceof Error ? groupError.message : String(groupError);
      return Promise.resolve({ attempted: false, reason: `${message} (process group: ${groupMessage})` });
    }
  }
}

/** Instruction that depends ONLY on `command.kind` (a trusted value set by
 * the caller, not by change-file content) — safe to place before the
 * prompt obtained from prepareAgentContext. */
export function commandInstruction(kind: CommandKind): string {
  switch (kind) {
    case "plan":
      return "Draft an implementation plan for the change described below, without changing code.";
    case "implement":
      return "Implement the tasks from tasks.md for the change described below.";
    case "review":
      return "Review the proposal (proposal.md/design.md/tasks.md) for the change described below, before any of it is implemented.";
    case "verify":
      return "Review the current implementation of the change described below against its tasks.md and its specs/*/spec.md delta. Uncheck any task in tasks.md whose stated verification does not actually hold.";
    case "status":
      return "Describe the current implementation status of the change described below.";
    case "list":
      return "Show available OpenSpec changes.";
    case "show":
      return "Show details for the selected OpenSpec change.";
    case "validate":
      return "Run strict validation for the selected OpenSpec change.";
    case "cancel":
      return "Stop the current execution for the change described below.";
    case "chain":
    case "confirmCheckpoint":
    case "resolvePermission":
      // HarnessChainRunner decomposes a chain into calls to this same
      // spawnAndStream path using each stage's own single-stage
      // CommandKind (`plan`/`review`/`implement`/...) — it never invokes
      // a CLI agent with "chain" or "confirmCheckpoint" itself.
      // "resolvePermission" likewise never reaches a CLI agent: it only
      // ever resolves an AcpSessionDriver's already-pending permission
      // promise for a run started by some earlier command (see
      // acp-session-driver.ts's `resolvePermission`).
      throw new Error(`commandInstruction: "${kind}" is not a single-agent command kind`);
  }
}

export async function* spawnAndStream(options: SpawnAndStreamOptions): AsyncGenerator<Event> {
  const { executable, args, cwd, runId, commandKind, stdin, signal } = options;
  const killConfirmationTimeoutMs = options.killConfirmationTimeoutMs ?? KILL_CONFIRMATION_TIMEOUT_MS;

  // An already-aborted signal never reaches a spawn at all — no process,
  // no partial output, just `cancelled` (design.md, "Cancellation
  // requested before the process starts").
  if (signal?.aborted) {
    yield { kind: "cancelled", runId, timestamp: nowIso() };
    return;
  }

  let child: ChildProcessWithoutNullStreams;
  try {
    child = crossSpawn(executable, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      // POSIX only: makes the child the leader of its own process group so
      // `terminateProcessTree` can kill the whole group. Windows tracks
      // parent/child relationships itself; `taskkill /T` needs no such flag.
      ...(process.platform !== "win32" ? { detached: true } : {}),
    }) as ChildProcessWithoutNullStreams;
  } catch (err) {
    yield {
      kind: "failed",
      runId,
      timestamp: nowIso(),
      reason: err instanceof Error ? err.message : String(err),
    };
    return;
  }

  if (stdin !== undefined) {
    child.stdin.write(stdin);
  }
  child.stdin.end();

  type QueueItem =
    | Event
    | { kind: "__exit__"; code: number | null }
    | { kind: "__error__"; error: Error }
    | { kind: "__cancelled__" }
    | { kind: "__kill_timed_out__" };
  const queue: QueueItem[] = [];
  let resolveWake: (() => void) | null = null;
  const wake = () => {
    resolveWake?.();
    resolveWake = null;
  };
  const push = (item: QueueItem) => {
    queue.push(item);
    wake();
  };

  // Once aborted, further process events are ignored — the terminal
  // `cancelled` event has already been queued, and ADR 0012 forbids any
  // event after a terminal one (task 1.5).
  let aborted = false;
  let killFailure: string | undefined;
  let killTimer: ReturnType<typeof setTimeout> | undefined;

  // Listeners are attached synchronously, BEFORE the first `yield` — this
  // guarantees that no process event is lost between spawning and the
  // start of queue consumption (all code before the first await/yield
  // runs in a single synchronous tick, before the event loop can deliver
  // data from the child process).
  child.stdout.on("data", (data: Buffer) => {
    if (aborted) return;
    push({ kind: "stdout", runId, timestamp: nowIso(), chunk: data.toString("utf8") });
  });
  child.stderr.on("data", (data: Buffer) => {
    if (aborted) return;
    push({ kind: "stderr", runId, timestamp: nowIso(), chunk: data.toString("utf8") });
  });
  child.on("error", (error) => {
    if (aborted) return;
    push({ kind: "__error__", error });
  });
  child.on("close", (code) => {
    // Deliberately NOT suppressed while aborted: this is the one signal
    // that says the process actually died, and it is what turns a
    // cancellation request into a `cancelled` event.
    if (aborted) {
      push({ kind: "__cancelled__" });
      return;
    }
    push({ kind: "__exit__", code });
  });

  const onAbort = () => {
    if (aborted) return;
    aborted = true;
    // Drop anything already buffered — a run the user stopped reports no
    // further output, only the terminal event (task 1.5).
    queue.length = 0;

    if (child.pid === undefined) {
      // No process to kill, so there is nothing to wait for.
      push({ kind: "__cancelled__" });
      return;
    }

    // The child's own `close` is the authority on whether it died; this
    // only says whether the kill could be attempted. Previously
    // `cancelled` was pushed right here, so the run reported itself
    // stopped while the process was still alive and still writing to the
    // workspace — the defect this change removes.
    void terminateProcessTree(child.pid).then((outcome) => {
      if (outcome.attempted) return;
      killFailure = outcome.reason;
    });

    // Ten seconds: terminating a tree that can be terminated takes
    // milliseconds, so this is not a budget for the normal case — it is
    // how long to wait before admitting the process outlived the request.
    // Wrong in the cheap direction: a slow-but-successful kill still
    // reports `cancelled`, and only a genuinely surviving process reaches
    // the failure.
    killTimer = setTimeout(() => {
      push({ kind: "__kill_timed_out__" });
    }, killConfirmationTimeoutMs);
  };
  signal?.addEventListener("abort", onAbort);

  try {
    yield { kind: "started", runId, timestamp: nowIso(), command: commandKind, cwd };

    let done = false;
    while (!done) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          resolveWake = resolve;
        });
        continue;
      }
      const item = queue.shift() as QueueItem;
      if (item.kind === "__cancelled__") {
        done = true;
        yield { kind: "cancelled", runId, timestamp: nowIso() };
      } else if (item.kind === "__kill_timed_out__") {
        done = true;
        // Not `cancelled`: the process outlived the request, and saying
        // otherwise is the whole defect. Name which of the two situations
        // this is — a kill that could not be attempted and a kill that
        // ran and was survived call for different actions.
        yield {
          kind: "failed",
          runId,
          timestamp: nowIso(),
          reason: killFailure
            ? `cancellation could not be carried out: ${killFailure}. The agent process may still be running.`
            : `the agent process did not exit within ${killConfirmationTimeoutMs / 1000}s of being terminated, and may still be running.`,
        };
      } else if (item.kind === "__exit__") {
        done = true;
        if (item.code === 0) {
          yield { kind: "completed", runId, timestamp: nowIso() };
        } else {
          yield {
            kind: "failed",
            runId,
            timestamp: nowIso(),
            reason: `${executable} exited with code ${item.code ?? "unknown"}`,
          };
        }
      } else if (item.kind === "__error__") {
        done = true;
        yield { kind: "failed", runId, timestamp: nowIso(), reason: item.error.message };
      } else {
        yield item;
      }
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
