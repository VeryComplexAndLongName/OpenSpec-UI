import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
vi.mock("cross-spawn", () => ({
  default: (...args: unknown[]) => spawnMock(...args),
}));

// Imported after vi.mock, so it uses the mocked cross-spawn.
const { spawnAndStream } = await import("./shared.js");

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = { write: vi.fn(), end: vi.fn() };
  pid: number | undefined;
  kill = vi.fn();
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

  it("aborting mid-run ends the stream with cancelled and emits no output after it (task 1.2, 1.5)", async () => {
    const child = new FakeChildProcess();
    child.pid = 4242;
    const taskkillChild = new EventEmitter();
    spawnMock.mockImplementation((exe: string) => (exe === "taskkill" ? taskkillChild : child));

    const controller = new AbortController();
    const gen = spawnAndStream({
      executable: "claude",
      args: ["-p"],
      cwd: "/workspace/repo",
      runId: "run-10",
      commandKind: "implement",
      signal: controller.signal,
    });

    await gen.next(); // started

    const cancelledPromise = gen.next();
    controller.abort();
    const result = await cancelledPromise;
    expect(result.value).toMatchObject({ kind: "cancelled", runId: "run-10" });

    // The killed process's own exit/output must not surface as further events.
    child.stdout.emit("data", Buffer.from("late output, must not be emitted\n"));
    child.emit("close", 0);

    const after = await gen.next();
    expect(after.done).toBe(true);
  });

  it("an already-aborted signal yields cancelled without spawning anything (task 1.4)", async () => {
    const controller = new AbortController();
    controller.abort();

    const gen = spawnAndStream({
      executable: "claude",
      args: ["-p"],
      cwd: "/workspace/repo",
      runId: "run-11",
      commandKind: "implement",
      signal: controller.signal,
    });

    const result = await gen.next();
    expect(result.value).toMatchObject({ kind: "cancelled", runId: "run-11" });
    expect((await gen.next()).done).toBe(true);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("terminates the process TREE via the termination helper rather than a bare child.kill() — guards the .cmd-shim case from design.md (task 1.3, 5.6)", async () => {
    const child = new FakeChildProcess();
    child.pid = 777;
    const taskkillChild = new EventEmitter();
    spawnMock.mockImplementation((exe: string) => (exe === "taskkill" ? taskkillChild : child));

    const controller = new AbortController();
    const gen = spawnAndStream({
      executable: "copilot",
      args: ["-p"],
      cwd: "/workspace/repo",
      runId: "run-12",
      commandKind: "implement",
      signal: controller.signal,
    });
    await gen.next(); // started

    const cancelledPromise = gen.next();
    controller.abort();
    await cancelledPromise;

    // A bare child.kill() would kill only the .cmd shim on Windows and
    // leave the real agent process running — the termination helper must
    // go through taskkill /T instead.
    expect(spawnMock).toHaveBeenCalledWith("taskkill", ["/T", "/F", "/PID", "777"], expect.anything());
    expect(child.kill).not.toHaveBeenCalled();
  });
});
