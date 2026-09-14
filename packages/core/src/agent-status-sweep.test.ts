// a-stale-status-is-swept: removing what a run that will never write again
// left in the status directory — and nothing else.

import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_STATUS_STALE_AFTER_MS,
  AGENT_STATUS_VERSION,
  AgentStatusWriter,
  readAgentStatuses,
  sweepAgentStatuses,
  type AgentStatusDocument,
} from "./agent-status.js";

// every-varying-check-has-a-budget:
// measured 2026-09-13 for this file alone at 0.2s idle; real reads, writes and removals
// in a temporary directory, whose time varies with load the way
// agent-status.test.ts's does, so it gets that file's budget.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

async function statusDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-status-sweep-"));
  roots.push(root);
  const directory = path.join(root, ".agent-status");
  await mkdir(directory, { recursive: true });
  return directory;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const NOW = new Date("2026-09-13T12:00:00.000Z");
const PAST_THE_WINDOW = AGENT_STATUS_STALE_AFTER_MS + 1_000;
const WITHIN_THE_WINDOW = AGENT_STATUS_STALE_AFTER_MS - 1_000;

/** A record as a writer leaves it, last renewed `heartbeatAgeMs` before
 * `NOW`. Returns its file name. */
async function writeRecord(
  directory: string,
  instanceId: string,
  heartbeatAgeMs: number,
  overrides: Partial<AgentStatusDocument> = {},
): Promise<string> {
  const at = new Date(NOW.getTime() - heartbeatAgeMs).toISOString();
  const document: AgentStatusDocument = {
    version: AGENT_STATUS_VERSION,
    instanceId,
    activity: "working",
    stage: null,
    changeName: "some-change",
    workingDirectory: directory,
    activityAt: at,
    heartbeatAt: at,
    runId: null,
    task: null,
    waiting: null,
    machine: "a-machine",
    ...overrides,
  };
  const fileName = `${instanceId}.json`;
  await writeFile(path.join(directory, fileName), JSON.stringify(document), "utf8");
  return fileName;
}

async function writeTemporaryFile(directory: string, fileName: string, ageMs: number): Promise<void> {
  const filePath = path.join(directory, fileName);
  await writeFile(filePath, "{", "utf8");
  const at = new Date(NOW.getTime() - ageMs);
  await utimes(filePath, at, at);
}

describe("sweepAgentStatuses", () => {
  it("removes a record past the window, keeps one within it, and names what it removed", async () => {
    const directory = await statusDirectory();
    const crashed = await writeRecord(directory, "crashed", PAST_THE_WINDOW);
    const working = await writeRecord(directory, "working", WITHIN_THE_WINDOW);

    const result = await sweepAgentStatuses(directory, { now: () => NOW });

    expect(result).toEqual({ removedRecords: [crashed], removedTemporaryFiles: [] });
    expect(await readdir(directory)).toEqual([working]);
  });

  it("keeps a record that was stale when first read and renewed before it was read again", async () => {
    const directory = await statusDirectory();
    const slow = await writeRecord(directory, "slow", PAST_THE_WINDOW);

    const result = await sweepAgentStatuses(directory, {
      now: () => NOW,
      beforeReread: async () => {
        await writeRecord(directory, "slow", 0);
      },
    });

    expect(result.removedRecords).toEqual([]);
    expect(await readdir(directory)).toEqual([slow]);
  });

  it("removes an old temporary file, keeps a fresh one, and leaves a file that is not a record's", async () => {
    const directory = await statusDirectory();
    const old = "crashed.json.0b1f.tmp";
    const fresh = "working.json.7c2e.tmp";
    const unrelated = "notes.tmp";
    await writeTemporaryFile(directory, old, PAST_THE_WINDOW);
    await writeTemporaryFile(directory, fresh, 1_000);
    await writeTemporaryFile(directory, unrelated, PAST_THE_WINDOW);

    const result = await sweepAgentStatuses(directory, { now: () => NOW });

    expect(result).toEqual({ removedRecords: [], removedTemporaryFiles: [old] });
    expect((await readdir(directory)).sort()).toEqual([fresh, unrelated].sort());
  });

  it("never removes a malformed record, however old, and the reader still reports it", async () => {
    const directory = await statusDirectory();
    const underAnotherName = await writeRecord(directory, "someone", PAST_THE_WINDOW, { instanceId: "someone-else" });
    await writeFile(path.join(directory, "garbled.json"), "{ not json", "utf8");

    const result = await sweepAgentStatuses(directory, { now: () => NOW });

    expect(result.removedRecords).toEqual([]);
    const { malformed } = await readAgentStatuses(directory, { now: () => NOW });
    expect(malformed.map((entry) => entry.fileName).sort()).toEqual(["garbled.json", underAnotherName].sort());
  });

  it("is not what reading does: a read leaves a gone record and an old temporary file where they are", async () => {
    const directory = await statusDirectory();
    await writeRecord(directory, "crashed", PAST_THE_WINDOW);
    await writeTemporaryFile(directory, "crashed.json.0b1f.tmp", PAST_THE_WINDOW);
    const before = (await readdir(directory)).sort();

    const { reports } = await readAgentStatuses(directory, { now: () => NOW });

    expect(reports.map((report) => report.gone)).toEqual([true]);
    expect((await readdir(directory)).sort()).toEqual(before);
  });

  it("lets two sweeps run over one directory at once: both succeed, and only what was stale goes", async () => {
    const directory = await statusDirectory();
    const stale = [await writeRecord(directory, "a", PAST_THE_WINDOW), await writeRecord(directory, "b", PAST_THE_WINDOW)];
    const working = await writeRecord(directory, "working", WITHIN_THE_WINDOW);

    const [first, second] = await Promise.all([
      sweepAgentStatuses(directory, { now: () => NOW }),
      sweepAgentStatuses(directory, { now: () => NOW }),
    ]);

    // Not "each removal counted once": on Windows a second removal of a
    // file whose first removal is still pending also succeeds, so both
    // sweeps can report the same name. Counting exactly would take a lock,
    // which ADR 0028 declined.
    expect(new Set([...first.removedRecords, ...second.removedRecords])).toEqual(new Set(stale));
    expect(await readdir(directory)).toEqual([working]);
  });

  it("reads an absent directory as nothing to remove", async () => {
    const directory = await statusDirectory();
    await rm(directory, { recursive: true, force: true });

    await expect(sweepAgentStatuses(directory, { now: () => NOW })).resolves.toEqual({
      removedRecords: [],
      removedTemporaryFiles: [],
    });
  });
});

describe("AgentStatusWriter and the sweep", () => {
  it("leaves only its own record when it starts over a directory of stale ones", async () => {
    const directory = await statusDirectory();
    await writeRecord(directory, "crashed-an-hour-ago", 60 * 60 * 1_000);
    await writeRecord(directory, "crashed-just-now", PAST_THE_WINDOW);
    await writeTemporaryFile(directory, "crashed-just-now.json.0b1f.tmp", PAST_THE_WINDOW);
    const writer = new AgentStatusWriter({ directory, workingDirectory: directory, now: () => NOW });

    await writer.start("starting");

    expect(await readdir(directory)).toEqual([`${writer.instanceId}.json`]);
    await writer.stop();
  });

  it("writes a record that holds only the present: exactly these fields, and no history", async () => {
    const directory = await statusDirectory();
    const writer = new AgentStatusWriter({ directory, workingDirectory: directory, changeName: "some-change" });
    await writer.start("planning");
    await writer.reportActivity("applying", "apply");
    await writer.reportActivity("verifying", "verify");

    const document = JSON.parse(await readFile(writer.filePath, "utf8")) as Record<string, unknown>;

    // `runId`, `task` and `waiting` are the present too: which run this is,
    // the task it is on now, and what it waits on now. None of them keeps
    // anything the run has left behind (a-run-says-which-task-it-is-on).
    // `machine` is where the run is now (a-run-is-signed-by-its-person).
    expect(Object.keys(document).sort()).toEqual([
      "activity",
      "activityAt",
      "changeName",
      "heartbeatAt",
      "instanceId",
      "machine",
      "runId",
      "stage",
      "task",
      "version",
      "waiting",
      "workingDirectory",
    ]);
    expect(document.activity).toBe("verifying");
    await writer.stop();
  });
});
