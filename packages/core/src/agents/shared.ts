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
}

/** Terminates the process tree rooted at `pid`, not only that one process.
 * `cross-spawn` resolves a `.cmd` shim (e.g. `copilot` on Windows) through
 * `cmd.exe` — killing only the direct child would kill the shim and leave
 * the real agent process running (see this file's header comment and
 * design.md, "Termination kills the process tree"). */
function terminateProcessTree(pid: number): void {
  if (process.platform === "win32") {
    const killer = crossSpawn("taskkill", ["/T", "/F", "/PID", String(pid)], { stdio: "ignore" });
    killer.on("error", () => {
      // Best-effort: if taskkill itself cannot be spawned, there is no
      // further fallback that also reaches a .cmd shim's real descendant.
    });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      process.kill(pid, "SIGKILL");
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
      // HarnessChainRunner decomposes a chain into calls to this same
      // spawnAndStream path using each stage's own single-stage
      // CommandKind (`plan`/`review`/`implement`/...) — it never invokes
      // a CLI agent with "chain" or "confirmCheckpoint" itself.
      throw new Error(`commandInstruction: "${kind}" is not a single-agent command kind`);
  }
}

export async function* spawnAndStream(options: SpawnAndStreamOptions): AsyncGenerator<Event> {
  const { executable, args, cwd, runId, commandKind, stdin, signal } = options;

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
    | { kind: "__aborted__" };
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
    if (aborted) return;
    push({ kind: "__exit__", code });
  });

  const onAbort = () => {
    if (aborted) return;
    aborted = true;
    if (child.pid !== undefined) terminateProcessTree(child.pid);
    // Drop anything already buffered — a run the user stopped reports no
    // further output, only the terminal `cancelled` event (task 1.5).
    queue.length = 0;
    push({ kind: "__aborted__" });
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
      if (item.kind === "__aborted__") {
        done = true;
        yield { kind: "cancelled", runId, timestamp: nowIso() };
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
