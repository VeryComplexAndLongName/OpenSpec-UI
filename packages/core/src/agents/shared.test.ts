import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

// Импортируется после vi.mock, чтобы использовать замоканный node:child_process.
const { spawnAndStream } = await import("./shared.js");

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = { write: vi.fn(), end: vi.fn() };
}

afterEach(() => {
  spawnMock.mockReset();
});

describe("spawnAndStream", () => {
  it("streams stdout/stderr and completes on exit code 0", async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const gen = spawnAndStream({
      executable: "claude",
      args: ["-p"],
      cwd: "/workspace/repo",
      runId: "run-1",
      commandKind: "implement",
      stdin: "hello prompt",
    });

    const started = await gen.next();
    expect(started.value).toMatchObject({ kind: "started", runId: "run-1", command: "implement", cwd: "/workspace/repo" });
    expect(spawnMock).toHaveBeenCalledWith("claude", ["-p"], { cwd: "/workspace/repo", stdio: ["pipe", "pipe", "pipe"] });
    expect(child.stdin.write).toHaveBeenCalledWith("hello prompt");
    expect(child.stdin.end).toHaveBeenCalled();

    const stdoutPromise = gen.next();
    child.stdout.emit("data", Buffer.from("building...\n"));
    expect((await stdoutPromise).value).toMatchObject({ kind: "stdout", chunk: "building...\n" });

    const stderrPromise = gen.next();
    child.stderr.emit("data", Buffer.from("warning\n"));
    expect((await stderrPromise).value).toMatchObject({ kind: "stderr", chunk: "warning\n" });

    const completedPromise = gen.next();
    child.emit("close", 0);
    expect((await completedPromise).value).toMatchObject({ kind: "completed" });

    expect((await gen.next()).done).toBe(true);
  });

  it("emits failed when process exits non-zero", async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const gen = spawnAndStream({
      executable: "claude",
      args: [],
      cwd: "/workspace/repo",
      runId: "run-2",
      commandKind: "review",
    });
    await gen.next(); // started

    const failedPromise = gen.next();
    child.emit("close", 1);
    const result = await failedPromise;
    expect(result.value).toMatchObject({ kind: "failed" });
    expect((result.value as { reason: string }).reason).toContain("1");
  });

  it("emits failed when the process itself errors (e.g. binary not found)", async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const gen = spawnAndStream({
      executable: "does-not-exist",
      args: [],
      cwd: "/workspace/repo",
      runId: "run-3",
      commandKind: "status",
    });
    await gen.next(); // started

    const failedPromise = gen.next();
    child.emit("error", new Error("ENOENT"));
    const result = await failedPromise;
    expect(result.value).toMatchObject({ kind: "failed", reason: "ENOENT" });
  });

  it("passes through unrecognized output verbatim without crashing", async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const gen = spawnAndStream({
      executable: "gemini",
      args: [],
      cwd: "/workspace/repo",
      runId: "run-4",
      commandKind: "plan",
    });
    await gen.next(); // started

    const weirdPromise = gen.next();
    child.stdout.emit("data", Buffer.from("\x00\x01binary-garbage\xff"));
    const weird = await weirdPromise;
    expect(weird.value?.kind).toBe("stdout");
  });
});
