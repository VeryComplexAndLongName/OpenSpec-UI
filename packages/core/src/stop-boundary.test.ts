import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event } from "./protocol.js";
import { TaskMarkerReader, countTickedTasks, readSettledTaskList, readTaskTickState, untilStopBoundary } from "./stop-boundary.js";

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

// a-half-written-task-list-stops-nothing: `tasks.md` is rewritten by
// truncating it and writing it again, and a reading between the two saw a
// task that is there as absent - which, on CI on 2026-09-22, made a run
// told to stop after 2.2 read 2.2 as missing.
describe("reading a task list somebody is writing", () => {
  const FULL = "## 2. Tasks\n- [x] 2.1 one\n- [x] 2.2 two\n- [ ] 2.3 three\n";

  it("waits for two readings to agree, so a list read mid-write is read again", async () => {
    const readings = ["", "## 2. Tasks\n- [x] 2.1 one\n", FULL, FULL];
    const read = async () => readings.shift() ?? FULL;

    expect(await readSettledTaskList("/change", { read, settleMs: 0 })).toBe(FULL);
    expect(readings).toEqual([]);
  });

  it("reads a list with no item as unreadable, never as a list without the task", async () => {
    expect(await readSettledTaskList("/change", { read: async () => "", settleMs: 0 })).toBeUndefined();
    expect(await readSettledTaskList("/change", { read: async () => "## 2. Tasks\n", settleMs: 0 })).toBeUndefined();
  });

  it("finds a named task in a list rewritten while it is read", async () => {
    const dir = await changeWithTasks(0, 3);
    await writeFile(path.join(dir, "tasks.md"), "", "utf8");
    const writing = new Promise<void>((resolve) => {
      setTimeout(() => void writeFile(path.join(dir, "tasks.md"), FULL, "utf8").then(() => resolve()), 20);
    });

    const [state] = await Promise.all([readTaskTickState(dir, "2.2"), writing]);

    expect(state).toBe("ticked");
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

function boundary(changeDir: string, source: AsyncIterable<Event>, afterTask?: string) {
  let asked = false;
  let held = afterTask;
  let wake: (() => void) | undefined;
  const calls = { ended: 0, denied: [] as string[], due: [] as Array<{ task: string; why: string }> };
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
      stopAfterTask: () => held,
      onStopAfterDue: (due) => {
        calls.due.push(due);
        held = undefined;
        // What the chain does with a due request: it becomes the pending
        // stop. Not for an absent task, which leaves the run going.
        if (due.why !== "absent") asked = true;
      },
      intervalMs: 20,
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
    // Each check moves the clock a whole interval. A tick that fires while
    // the previous tick's read is still on the disk wakes nothing, and the
    // next tick is two seconds of fake time away; waitFor's own advance of
    // 50ms a check never reached it within its one real second, which is how
    // this failed on a loaded CI runner on 2026-09-17
    // (the-stop-boundary-test-moves-its-clock).
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      expect(b.calls.ended).toBe(1);
    }, { timeout: 10_000 });
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

// a-run-is-told-where-to-stop 2.2 and 2.3: a request naming a task is held
// until that task is done, and the run keeps working while it is.
describe("untilStopBoundary, holding a request that names a task", () => {
  /** A task list whose numbers are given, since this is about one task by
   * name and `writeTasks` renumbers what it writes. */
  async function writeNamedTasks(dir: string, tasks: Array<[string, boolean]>): Promise<void> {
    await mkdir(dir, { recursive: true });
    const lines = ["## 2. Tasks", ...tasks.map(([number, ticked]) => `- [${ticked ? "x" : " "}] ${number} something`), ""];
    await writeFile(path.join(dir, "tasks.md"), lines.join("\n"), "utf8");
  }

  it("says the request is due once the named task is ticked, and ends nothing before that", async () => {
    const dir = await changeWithTasks(0, 3);
    await writeNamedTasks(dir, [["2.1", false], ["2.2", false], ["2.3", false]]);
    const source = feed();
    const b = boundary(dir, source.events, "2.2");

    source.push(stdout("Starting task 2.1\n"));
    await vi.waitFor(() => expect(b.seen.length).toBe(1));
    expect(b.calls.due).toEqual([]);
    expect(b.calls.ended).toBe(0);

    await writeNamedTasks(dir, [["2.1", true], ["2.2", true], ["2.3", false]]);
    await vi.waitFor(() => expect(b.calls.due).toEqual([{ task: "2.2", why: "ticked" }]), { timeout: 5_000 });

    source.push("end");
    await b.run;
  });


  it("ends the stage on the task it was told to stop after, not at the next point after it", async () => {
    // The owner's reading, and the right one: the tick of 4.6 is itself a
    // sound point, so waiting for another one lets the agent into 4.7.
    const dir = await changeWithTasks(0, 3);
    await writeNamedTasks(dir, [["2.1", false], ["2.2", false], ["2.3", false]]);
    const source = feed();
    const b = boundary(dir, source.events, "2.2");

    source.push(stdout("Starting task 2.1\n"));
    await vi.waitFor(() => expect(b.seen.length).toBe(1));
    expect(b.calls.ended).toBe(0);

    await writeNamedTasks(dir, [["2.1", true], ["2.2", true], ["2.3", false]]);

    // No further marker and no further tick: the run ends on this one.
    await vi.waitFor(() => expect(b.calls.ended).toBe(1), { timeout: 5_000 });
    expect(b.seen.some((event) => event.kind === "stopRequested")).toBe(true);

    source.push("end");
    await b.run;
  });
  it("says it is due when the agent names a task after the one it was given", async () => {
    const dir = await changeWithTasks(0, 3);
    await writeNamedTasks(dir, [["2.1", false], ["2.2", false], ["2.3", false]]);
    const source = feed();
    const b = boundary(dir, source.events, "2.2");

    source.push(stdout("Starting task 2.3\n"));
    await vi.waitFor(() => expect(b.calls.due).toEqual([{ task: "2.2", why: "passed" }]), { timeout: 5_000 });

    source.push("end");
    await b.run;
  });

  it("says it is due, as absent, where the change has no such task", async () => {
    const dir = await changeWithTasks(0, 2);
    const source = feed();
    const b = boundary(dir, source.events, "9.9");

    await vi.waitFor(() => expect(b.calls.due).toEqual([{ task: "9.9", why: "absent" }]), { timeout: 5_000 });
    expect(b.calls.ended).toBe(0);

    source.push("end");
    await b.run;
  });

  it("answers once, not on every wake", async () => {
    const dir = await changeWithTasks(2, 1);
    await writeNamedTasks(dir, [["1.1", true], ["1.2", true], ["2.1", false]]);
    const source = feed();
    const b = boundary(dir, source.events, "1.2");

    await vi.waitFor(() => expect(b.calls.due).toHaveLength(1), { timeout: 5_000 });
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(b.calls.due).toHaveLength(1);

    source.push("end");
    await b.run;
  });
});
