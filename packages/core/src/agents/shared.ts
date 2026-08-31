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
      return "Review the current implementation of the change described below against the specification.";
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
  const { executable, args, cwd, runId, commandKind, stdin } = options;

  let child: ChildProcessWithoutNullStreams;
  try {
    child = crossSpawn(executable, args, { cwd, stdio: ["pipe", "pipe", "pipe"] }) as ChildProcessWithoutNullStreams;
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

  type QueueItem = Event | { kind: "__exit__"; code: number | null } | { kind: "__error__"; error: Error };
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

  // Listeners are attached synchronously, BEFORE the first `yield` — this
  // guarantees that no process event is lost between spawning and the
  // start of queue consumption (all code before the first await/yield
  // runs in a single synchronous tick, before the event loop can deliver
  // data from the child process).
  child.stdout.on("data", (data: Buffer) => {
    push({ kind: "stdout", runId, timestamp: nowIso(), chunk: data.toString("utf8") });
  });
  child.stderr.on("data", (data: Buffer) => {
    push({ kind: "stderr", runId, timestamp: nowIso(), chunk: data.toString("utf8") });
  });
  child.on("error", (error) => {
    push({ kind: "__error__", error });
  });
  child.on("close", (code) => {
    push({ kind: "__exit__", code });
  });

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
    if (item.kind === "__exit__") {
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
}
