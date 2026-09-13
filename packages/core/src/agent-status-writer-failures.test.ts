// a-status-write-never-stops-a-run: what becomes of a run when a write of
// its status record is refused.
//
// A second agent's run on Windows died from its own record: the
// heartbeat's rename was refused with EPERM, nothing handled the
// rejection, and Node ended the process. These drive the writer through
// its file-operations seam, over files kept in memory, so a refusal
// happens on demand rather than whenever Windows happens to produce one.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_STATUS_RENEW_INTERVAL_MS,
  AgentStatusWriter,
  type AgentStatusDocument,
  type AgentStatusFileOperations,
} from "./agent-status.js";

const DIRECTORY = "/status";

interface Gate {
  opened: Promise<void>;
  open: () => void;
}

function gate(): Gate {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

/** Files kept in memory, every write and rename logged in order, a rename
 * that can be refused on demand, and a write that can be held open. */
function memoryFiles() {
  const contents = new Map<string, string>();
  const log: string[] = [];
  const state = {
    /** How many of the next renames are refused; Infinity refuses all. */
    refuseRenames: 0,
    renameAttempts: 0,
    /** Held until opened, by the next write that begins. */
    holdNextWrite: undefined as Gate | undefined,
  };
  const files: AgentStatusFileOperations = {
    async mkdir() {
      return undefined;
    },
    async writeFile(filePath, data) {
      log.push(`write ${filePath}`);
      const held = state.holdNextWrite;
      if (held) {
        state.holdNextWrite = undefined;
        await held.opened;
      }
      contents.set(filePath, data);
    },
    async rename(from, to) {
      state.renameAttempts += 1;
      if (state.refuseRenames > 0) {
        state.refuseRenames -= 1;
        throw Object.assign(new Error(`EPERM: operation not permitted, rename '${from}' -> '${to}'`), { code: "EPERM" });
      }
      const data = contents.get(from);
      if (data === undefined) throw Object.assign(new Error(`ENOENT: ${from}`), { code: "ENOENT" });
      contents.delete(from);
      contents.set(to, data);
      log.push(`rename ${from}`);
    },
    async rm(filePath) {
      log.push(`rm ${filePath}`);
      contents.delete(filePath);
    },
  };
  return { files, contents, log, state };
}

function readRecord(memory: ReturnType<typeof memoryFiles>, writer: AgentStatusWriter): AgentStatusDocument {
  const raw = memory.contents.get(writer.filePath);
  if (raw === undefined) throw new Error("no record");
  return JSON.parse(raw) as AgentStatusDocument;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AgentStatusWriter — a refused write never stops the run", () => {
  it("asks again when a rename is refused as in use, and the record lands", async () => {
    const memory = memoryFiles();
    const writer = new AgentStatusWriter({ directory: DIRECTORY, workingDirectory: DIRECTORY, files: memory.files });
    await writer.start("first");

    memory.state.refuseRenames = 2;
    await expect(writer.reportActivity("second")).resolves.toBeUndefined();

    expect(memory.state.renameAttempts).toBe(1 + 3);
    expect(readRecord(memory, writer).activity).toBe("second");
    await writer.stop();
  });

  it("keeps the previous record when a rename is always refused, removes nothing to make room, leaves no temporary file, and writes again once it may", async () => {
    const memory = memoryFiles();
    const writer = new AgentStatusWriter({ directory: DIRECTORY, workingDirectory: DIRECTORY, files: memory.files });
    await writer.start("first");

    memory.state.refuseRenames = Number.POSITIVE_INFINITY;
    await expect(writer.reportActivity("second")).resolves.toBeUndefined();

    expect(readRecord(memory, writer).activity).toBe("first");
    expect([...memory.contents.keys()]).toEqual([writer.filePath]);
    expect(memory.log).not.toContain(`rm ${writer.filePath}`);

    memory.state.refuseRenames = 0;
    await writer.reportActivity("third");
    expect(readRecord(memory, writer).activity).toBe("third");
    await writer.stop();
  });

  it("still refuses to start when its first record cannot be written, so the run goes unreported", async () => {
    const memory = memoryFiles();
    memory.state.refuseRenames = Number.POSITIVE_INFINITY;
    const writer = new AgentStatusWriter({ directory: DIRECTORY, workingDirectory: DIRECTORY, files: memory.files });

    await expect(writer.start("first")).rejects.toMatchObject({ code: "EPERM" });
    expect(memory.contents.size).toBe(0);
  });

  it("raises no unhandled rejection from a heartbeat whose every write is refused", async () => {
    vi.useFakeTimers();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const memory = memoryFiles();
      const writer = new AgentStatusWriter({ directory: DIRECTORY, workingDirectory: DIRECTORY, files: memory.files });
      await writer.start("first");

      memory.state.refuseRenames = Number.POSITIVE_INFINITY;
      const attemptsBefore = memory.state.renameAttempts;
      // Three renewals, and time for the last one's retries to run out.
      await vi.advanceTimersByTimeAsync(AGENT_STATUS_RENEW_INTERVAL_MS * 3 + 1_000);

      expect(memory.state.renameAttempts).toBeGreaterThanOrEqual(attemptsBefore + 3);
      expect(readRecord(memory, writer).activity).toBe("first");
      await writer.stop();

      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("takes a renewal that falls due during a slow write after that write, never beside it", async () => {
    vi.useFakeTimers();
    const memory = memoryFiles();
    const writer = new AgentStatusWriter({ directory: DIRECTORY, workingDirectory: DIRECTORY, files: memory.files });
    await writer.start("first");
    memory.log.length = 0;

    const held = gate();
    memory.state.holdNextWrite = held;
    const slow = writer.reportActivity("slow");
    await vi.advanceTimersByTimeAsync(AGENT_STATUS_RENEW_INTERVAL_MS);

    // The renewal fell due while the slow write was held: nothing of it
    // has begun.
    expect(memory.log).toHaveLength(1);

    held.open();
    await slow;
    // Each write also tidies its temporary file afterwards; the order that
    // matters is of writes and renames.
    const steps = (): string[] => memory.log.filter((entry) => !entry.startsWith("rm "));
    await vi.waitFor(() => expect(steps()).toHaveLength(4));

    const [firstWrite, firstRename, secondWrite, secondRename] = steps();
    expect(firstWrite).toMatch(/^write /u);
    expect(firstRename).toBe(firstWrite?.replace(/^write /u, "rename "));
    expect(secondWrite).toMatch(/^write /u);
    expect(secondRename).toBe(secondWrite?.replace(/^write /u, "rename "));
    expect(readRecord(memory, writer).activity).toBe("slow");
    await writer.stop();
  });

  it("leaves no record when a clean stop comes while a write is under way", async () => {
    const memory = memoryFiles();
    const writer = new AgentStatusWriter({ directory: DIRECTORY, workingDirectory: DIRECTORY, files: memory.files });
    await writer.start("first");

    const held = gate();
    memory.state.holdNextWrite = held;
    const pending = writer.reportActivity("last words");
    // Under way, not merely asked for: a write that has not begun when the
    // stop comes writes nothing at all, which would prove nothing here.
    await vi.waitFor(() => expect(memory.state.holdNextWrite).toBeUndefined());

    const stopping = writer.stop();
    held.open();
    await Promise.all([pending, stopping]);

    expect([...memory.contents.keys()]).toEqual([]);
  });
});
