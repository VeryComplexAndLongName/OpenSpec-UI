import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event } from "./protocol.js";
import { TaskMarkerReader, countTickedTasks, untilStopBoundary } from "./stop-boundary.js";

// every-varying-check-has-a-budget: a task list in a temporary directory,
// no process and no git. Measured 2026-09-14 under 40ms for the whole file.
vi.setConfig({ testTimeout: 15_000 });

const temporary: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function changeWithTasks(ticked: number, open: number): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "stop-boundary-"));
  temporary.push(dir);
  await writeTasks(dir, ticked, open);
  return dir;
}

async function writeTasks(dir: string, ticked: number, open: number): Promise<void> {
  await mkdir(dir, { recursive: true });
  const lines = [
    "## 1. Tasks",
    ...Array.from({ length: ticked }, (_, i) => `- [x] 1.${i + 1} done`),
    ...Array.from({ length: open }, (_, i) => `- [ ] 2.${i + 1} open`),
    "",
  ];
  await writeFile(path.join(dir, "tasks.md"), lines.join("\n"), "utf8");
}

const stdout = (chunk: string): Event => ({ kind: "stdout", runId: "r1", timestamp: "t", chunk });
const reply = (text: string): Event => ({
  kind: "agentUpdate",
  runId: "r1",
  timestamp: "t",
  update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
});
const reasoning = (text: string): Event => ({
  kind: "agentUpdate",
  runId: "r1",
  timestamp: "t",
  update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text } },
});

describe("TaskMarkerReader", () => {
  it("reads a marker split across two chunks once its line is whole", () => {
    const reader = new TaskMarkerReader();
    expect(reader.read(stdout("Starting ta"))).toEqual([]);
    expect(reader.read(stdout("sk 2.3\nworking\n"))).toEqual(["2.3"]);
  });

  it("takes a reply without a newline as said once something else happens", () => {
    const reader = new TaskMarkerReader();
    expect(reader.read(reply("Starting task 1.2"))).toEqual([]);
    expect(reader.read({ kind: "progress", runId: "r1", timestamp: "t", message: "tool" })).toEqual(["1.2"]);
  });

  it("reads no marker from reasoning, and lets reasoning neither complete nor break a reply", () => {
    const reader = new TaskMarkerReader();
    expect(reader.read(reasoning("Starting task 9.9\n"))).toEqual([]);
    expect(reader.read(reply("Starting task 4."))).toEqual([]);
    expect(reader.read(reasoning("2 is next\n"))).toEqual([]);
    expect(reader.read(reply("1\n"))).toEqual(["4.1"]);
  });
});

describe("countTickedTasks", () => {
  it("counts ticked tasks, and says nothing for a list it cannot read", async () => {
    expect(await countTickedTasks(await changeWithTasks(2, 3))).toBe(2);
    expect(await countTickedTasks(path.join(os.tmpdir(), "no-such-change-here"))).toBeUndefined();
  });
});

/** A run a test feeds one event at a time, ended the way a real one is. */
function feed() {
  const queue: Array<Event | "end"> = [];
  let wake: (() => void) | undefined;
  const push = (...items: Array<Event | "end">) => {
    queue.push(...items);
    wake?.();
  };
  async function* events(): AsyncGenerator<Event> {
    for (;;) {
      while (queue.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
      const item = queue.shift();
      if (item === undefined || item === "end") return;
      yield item;
    }
  }
  return { events: events(), push };
}

function boundary(changeDir: string, source: AsyncIterable<Event>) {
  let asked = false;
  let wake: (() => void) | undefined;
  const calls = { ended: 0, denied: [] as string[] };
  const seen: Event[] = [];
  const run = (async () => {
    for await (const event of untilStopBoundary({
      events: source,
      changeDir,
      stopAsked: () => asked,
      onWake: (next) => {
        wake = next;
      },
      announce: async function* () {
        yield { kind: "stopRequested", runId: "r1", timestamp: "t", reason: "wrong branch", outcome: "asked" };
      },
      denyPermission: (requestId) => calls.denied.push(requestId),
      endRun: () => {
        calls.ended += 1;
      },
    })) seen.push(event);
  })();
  const ask = () => {
    asked = true;
    wake?.();
  };
  return { run, ask, calls, seen };
}

describe("untilStopBoundary", () => {
  it("passes every event through unchanged while no stop is asked", async () => {
    const dir = await changeWithTasks(0, 2);
    const source = feed();
    const b = boundary(dir, source.events);
    const events = [stdout("Starting task 2.1\n"), stdout("Starting task 2.2\n")];

    source.push(...events, "end");
    await b.run;

    expect(b.seen).toEqual(events);
    expect(b.calls.ended).toBe(0);
  });

  it("announces the stop, and ends the run at the next marker naming another task", async () => {
    const dir = await changeWithTasks(0, 2);
    const source = feed();
    const b = boundary(dir, source.events);

    source.push(stdout("Starting task 2.1\n"));
    await vi.waitFor(() => expect(b.seen).toHaveLength(1));
    b.ask();
    await vi.waitFor(() => expect(b.seen.at(-1)?.kind).toBe("stopRequested"));
    source.push(stdout("Starting task 2.1\n"));
    await vi.waitFor(() => expect(b.seen).toHaveLength(3));
    expect(b.calls.ended).toBe(0);

    source.push(stdout("Starting task 2.2\n"), "end");
    await b.run;
    expect(b.calls.ended).toBe(1);
  });

  it("ends the run when a task is ticked, read on the check interval", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const dir = await changeWithTasks(0, 2);
    const source = feed();
    const b = boundary(dir, source.events);

    b.ask();
    await vi.waitFor(() => expect(b.seen.at(-1)?.kind).toBe("stopRequested"));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(b.calls.ended).toBe(0);

    await writeTasks(dir, 1, 1);
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(b.calls.ended).toBe(1));
    source.push("end");
    await b.run;
  });

  it("answers a pending permission deny and ends the run at once", async () => {
    const dir = await changeWithTasks(0, 2);
    const source = feed();
    const b = boundary(dir, source.events);

    source.push({ kind: "permissionRequest", runId: "r1", timestamp: "t", requestId: "perm-1", description: "Write to x" });
    await vi.waitFor(() => expect(b.seen).toHaveLength(1));
    b.ask();
    await vi.waitFor(() => expect(b.calls.ended).toBe(1));
    expect(b.calls.denied).toEqual(["perm-1"]);
    source.push("end");
    await b.run;
  });
});
