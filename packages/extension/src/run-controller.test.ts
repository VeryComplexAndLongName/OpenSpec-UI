import { describe, expect, it } from "vitest";
import type { AgentRunner, Command, Event } from "@openspec-ui/core";
import { vi } from "vitest";

const statusChangeMock = vi.fn();
const listChangesMock = vi.fn();
const showChangeMock = vi.fn();
const validateChangeMock = vi.fn();
vi.mock("@openspec-ui/core", async () => {
  const actual = await vi.importActual<typeof import("@openspec-ui/core")>("@openspec-ui/core");
  return {
    ...actual,
    statusChange: (...args: unknown[]) => statusChangeMock(...args),
    listChanges: (...args: unknown[]) => listChangesMock(...args),
    showChange: (...args: unknown[]) => showChangeMock(...args),
    validateChange: (...args: unknown[]) => validateChangeMock(...args),
  };
});

import { RunController } from "./run-controller.js";

function fakeRunner(events: Event[]): AgentRunner {
  return {
    async *run(): AsyncIterable<Event> {
      for (const event of events) yield event;
    },
  };
}

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("RunController", () => {
  it("forwards every event to subscribed listeners", async () => {
    const events: Event[] = [
      { kind: "started", runId: "run-1", timestamp: "t", command: "implement", cwd: "/workspace/repo" },
      { kind: "completed", runId: "run-1", timestamp: "t" },
    ];
    const controller = new RunController();
    const received: Event[] = [];
    controller.onEvent((e) => received.push(e));

    await controller.run(fakeRunner(events), command);

    expect(received).toEqual(events);
  });

  it("reports isRunning true during the run and false after it settles", async () => {
    let resolveRun: (() => void) | undefined;
    const runner: AgentRunner = {
      async *run(): AsyncIterable<Event> {
        yield { kind: "started", runId: "run-1", timestamp: "t", command: "implement", cwd: "/x" };
        await new Promise<void>((resolve) => {
          resolveRun = resolve;
        });
        yield { kind: "completed", runId: "run-1", timestamp: "t" };
      },
    };
    const controller = new RunController();
    const runPromise = controller.run(runner, command);
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.isRunning).toBe(true);
    resolveRun?.();
    await runPromise;
    expect(controller.isRunning).toBe(false);
  });

  it("cancel() sends a cancel Command with the same runId through the active runner", async () => {
    const runCalls: Command[] = [];
    let resolveFirstRun: (() => void) | undefined;
    const runner: AgentRunner = {
      async *run(cmd: Command): AsyncIterable<Event> {
        runCalls.push(cmd);
        if (cmd.kind !== "cancel") {
          yield { kind: "started", runId: cmd.runId, timestamp: "t", command: cmd.kind, cwd: cmd.cwd };
          await new Promise<void>((resolve) => {
            resolveFirstRun = resolve;
          });
        }
        yield { kind: "completed", runId: cmd.runId, timestamp: "t" };
      },
    };
    const controller = new RunController();
    const runPromise = controller.run(runner, command);
    await Promise.resolve();
    await Promise.resolve();

    const cancelled = controller.cancel();
    expect(cancelled).toBe(true);
    expect(runCalls).toHaveLength(2);
    expect(runCalls[1]).toEqual({ ...command, kind: "cancel" });

    resolveFirstRun?.();
    await runPromise;
  });

  it("cancel() returns false when nothing is running", () => {
    const controller = new RunController();
    expect(controller.cancel()).toBe(false);
  });

  it("unsubscribe stops delivering further events", async () => {
    const controller = new RunController();
    const received: Event[] = [];
    const unsubscribe = controller.onEvent((e) => received.push(e));
    unsubscribe();

    await controller.run(
      fakeRunner([{ kind: "completed", runId: "run-1", timestamp: "t" }]),
      command,
    );

    expect(received).toHaveLength(0);
  });

  it("uses openspec status --json flow for status commands", async () => {
    statusChangeMock.mockResolvedValueOnce({
      changeName: "x",
      schemaName: "spec-driven",
      progress: { total: 2, complete: 1, remaining: 1 },
      artifacts: [],
      root: { path: "/workspace/repo", source: "nearest" },
    });

    const controller = new RunController();
    const received: Event[] = [];
    controller.onEvent((e) => received.push(e));

    const statusCommand: Command = {
      kind: "status",
      cwd: "/workspace/repo",
      runId: "run-status",
      context: { changeDir: "/workspace/repo/openspec/changes/x" },
    };

    await controller.run(fakeRunner([]), statusCommand);

    expect(statusChangeMock).toHaveBeenCalledWith("x", { cwd: "/workspace/repo" });
    expect(received[0]).toMatchObject({ kind: "started", runId: "run-status" });
    expect(received[1]).toMatchObject({ kind: "stdout", runId: "run-status" });
    expect(received[2]).toMatchObject({ kind: "completed", runId: "run-status" });
  });

  it("uses openspec list --json flow for list commands", async () => {
    listChangesMock.mockResolvedValueOnce({
      changes: [{ name: "x", completedTasks: 1, totalTasks: 1, lastModified: "2026-08-05T00:00:00Z", status: "complete" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });

    const controller = new RunController();
    const received: Event[] = [];
    controller.onEvent((e) => received.push(e));

    const listCommand: Command = {
      kind: "list",
      cwd: "/workspace/repo",
      runId: "run-list",
      context: { changeDir: "/workspace/repo/openspec/changes/x" },
    };

    await controller.run(fakeRunner([]), listCommand);

    expect(listChangesMock).toHaveBeenCalledWith({ cwd: "/workspace/repo" });
    expect(received[0]).toMatchObject({ kind: "started", runId: "run-list", command: "list" });
    expect(received[2]).toMatchObject({ kind: "completed", runId: "run-list" });
  });
});
