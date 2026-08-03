import { describe, expect, it } from "vitest";
import type { AgentRunner, Command, Event } from "@openspec-ui/core";
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
});
