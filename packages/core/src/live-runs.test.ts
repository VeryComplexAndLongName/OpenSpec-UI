import { describe, expect, it } from "vitest";
import { LiveRuns } from "./live-runs.js";
import type { Command, Event } from "./protocol.js";

// a-change-is-run-from-its-card 2.2: pure, over events written here.

const chain: Command = {
  kind: "chain",
  cwd: "/repo",
  runId: "chain-1",
  context: { changeDir: "/repo/openspec/changes/demo" },
};

const at = (n: number) => `2026-09-14T10:00:0${n}.000Z`;

/** Hands the events out one at a time, so a test can look between them. */
function stepper(events: Event[]) {
  let release: (() => void) | undefined;
  async function* source(): AsyncIterable<Event> {
    for (const event of events) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      yield event;
    }
  }
  return { source: source(), next: () => release?.() };
}

describe("LiveRuns", () => {
  it("follows one run through its events, and passes them on unchanged and in order", async () => {
    const events: Event[] = [
      { kind: "started", runId: "chain-1", timestamp: at(0), command: "chain", cwd: "/repo" },
      { kind: "stageStarted", runId: "chain-1", timestamp: at(1), stage: "propose", agentId: "claude-cli" },
      { kind: "checkpoint", runId: "chain-1", timestamp: at(2), stage: "propose", nextStage: "review", nextAgentId: "claude-cli" },
      { kind: "stageStarted", runId: "chain-1", timestamp: at(3), stage: "review", agentId: "claude-cli" },
      { kind: "stopRequested", runId: "chain-1", timestamp: at(4), reason: "wrong branch", by: "ada@example.com", outcome: "asked" },
      { kind: "cancelled", runId: "chain-1", timestamp: at(5) },
    ];
    const live = new LiveRuns();
    const seen: Event[] = [];
    const snapshots: Array<ReturnType<LiveRuns["list"]>> = [];

    for await (const event of live.track(chain, (async function* () { yield* events; })())) {
      seen.push(event);
      snapshots.push(live.list());
    }

    expect(seen).toEqual(events);
    // It appears when it starts.
    expect(snapshots[0]).toEqual([{
      runId: "chain-1",
      changeName: "demo",
      kind: "chain",
      startedAt: at(0),
      waiting: false,
      stopRequested: null,
    }]);
    // Waiting after the checkpoint, and no longer after the next stage starts.
    expect(snapshots[2]?.[0]?.waiting).toBe(true);
    expect(snapshots[3]?.[0]?.waiting).toBe(false);
    // Holding the stop once asked.
    expect(snapshots[4]?.[0]?.stopRequested).toEqual({ reason: "wrong branch", by: "ada@example.com" });
    // Gone once cancelled.
    expect(snapshots[5]).toEqual([]);
    expect(live.get("chain-1")).toBeUndefined();
  });

  it("holds a chain again when a stage that failed is attempted again, keeping when it first started", async () => {
    const live = new LiveRuns();
    const { source, next } = stepper([
      { kind: "started", runId: "chain-1", timestamp: at(0), command: "chain", cwd: "/repo" },
      { kind: "failed", runId: "chain-1", timestamp: at(1), reason: "verify left tasks unchecked" },
      { kind: "stageStarted", runId: "chain-1", timestamp: at(2), stage: "apply", agentId: "claude-cli", attempt: 2 },
      { kind: "completed", runId: "chain-1", timestamp: at(3) },
    ]);
    const iterator = live.track(chain, source)[Symbol.asyncIterator]();

    const pull = async () => {
      const result = iterator.next();
      next();
      return result;
    };
    await pull();
    expect(live.list()).toHaveLength(1);
    await pull();
    expect(live.list()).toEqual([]);
    await pull();
    expect(live.get("chain-1")).toMatchObject({ startedAt: at(0), waiting: false });
    await pull();
    expect(live.list()).toEqual([]);
    expect((await pull()).done).toBe(true);
  });

  it("does not hold a stop that found nothing to stop", async () => {
    const live = new LiveRuns();
    const events: Event[] = [
      { kind: "started", runId: "chain-1", timestamp: at(0), command: "chain", cwd: "/repo" },
      { kind: "stopRequested", runId: "chain-1", timestamp: at(1), reason: "r", outcome: "nothing-to-stop" },
    ];
    let stopRequested: unknown = "unread";
    for await (const event of live.track(chain, (async function* () { yield* events; })())) {
      if (event.kind === "stopRequested") stopRequested = live.get("chain-1")?.stopRequested;
    }
    expect(stopRequested).toBeNull();
  });

  it("stays waiting on a permission through a usage report", async () => {
    const live = new LiveRuns();
    const events: Event[] = [
      { kind: "started", runId: "chain-1", timestamp: at(0), command: "chain", cwd: "/repo" },
      { kind: "permissionRequest", runId: "chain-1", timestamp: at(1), requestId: "p1", description: "Write to x" },
      { kind: "usageReported", runId: "chain-1", timestamp: at(2), usage: { costUsd: 0.1 } },
    ];
    let waiting: boolean | undefined;
    for await (const event of live.track(chain, (async function* () { yield* events; })())) {
      if (event.kind === "usageReported") waiting = live.get("chain-1")?.waiting;
    }
    expect(waiting).toBe(true);
  });

  it("does not track a command that is a request about a run", async () => {
    const live = new LiveRuns();
    const stop: Command = { ...chain, kind: "stop", reason: "r" };
    const events: Event[] = [{ kind: "stopRequested", runId: "chain-1", timestamp: at(0), reason: "r", outcome: "nothing-to-stop" }];
    const seen: Event[] = [];
    for await (const event of live.track(stop, (async function* () { yield* events; })())) seen.push(event);
    expect(seen).toEqual(events);
    expect(live.list()).toEqual([]);
  });

  it("releases a run whose events stop being read", async () => {
    const live = new LiveRuns();
    const events: Event[] = [
      { kind: "started", runId: "chain-1", timestamp: at(0), command: "chain", cwd: "/repo" },
      { kind: "stdout", runId: "chain-1", timestamp: at(1), chunk: "working\n" },
    ];
    for await (const event of live.track(chain, (async function* () { yield* events; })())) {
      if (event.kind === "started") break;
    }
    expect(live.list()).toEqual([]);
  });

  it("gives copies, so what it holds cannot be changed from outside", async () => {
    const live = new LiveRuns();
    const events: Event[] = [{ kind: "started", runId: "chain-1", timestamp: at(0), command: "chain", cwd: "/repo" }];
    for await (const _event of live.track(chain, (async function* () { yield* events; })())) {
      const listed = live.list()[0]!;
      listed.waiting = true;
      expect(live.get("chain-1")?.waiting).toBe(false);
    }
  });
});
