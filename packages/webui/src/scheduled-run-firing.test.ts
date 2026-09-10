import { describe, expect, it, vi } from "vitest";
import { fireDueSchedule, type ScheduleFiringHost } from "./scheduled-run-firing.js";
import type { RunWithHarnessDispatch } from "./run-with-harness-dispatch.js";
import type { ScheduledRun } from "@openspec-ui/core/browser";

// a-schedule-keeps-its-promise, task 7.4. The shell's half of the firing
// loop used to live inside `standalone-entry.tsx`, which is a bootstrap
// script and is not unit tested — which is how it came to remove the
// entry before the dialog was guaranteed and to point the editor at a
// change it had not loaded.

const known = { active: ["demo", "other"], archived: ["2026-09-01-old"] };
const now = new Date("2026-09-09T12:00:00.000Z");

function entry(changeName: string, startAt: string, path: ScheduledRun["path"] = "chain"): ScheduledRun {
  return { changeName, path, startAt, requestedAt: "2026-09-09T08:00:00.000Z" };
}

function dispatch(offered: ScheduledRun["path"][] = ["chain", "single-stage"]): RunWithHarnessDispatch {
  return {
    target: "chain",
    changeDir: "/repo/openspec/changes/demo",
    plan: {
      resolved: "chain",
      because: "x",
      stageAgents: [],
      offered: offered.map((id) => ({ id, title: id, describes: id })),
      findings: [],
    },
  } as unknown as RunWithHarnessDispatch;
}

function makeHost(overrides: Partial<ScheduleFiringHost> = {}): {
  host: ScheduleFiringHost;
  said: string[];
  removed: ScheduledRun[];
  started: Array<{ path: string }>;
  opened: string[];
} {
  const said: string[] = [];
  const removed: ScheduledRun[] = [];
  const started: Array<{ path: string }> = [];
  const opened: string[] = [];
  const host: ScheduleFiringHost = {
    loadEntries: async () => [],
    removeEntry: async (item) => { removed.push(item); },
    resolveDispatch: async () => dispatch(),
    loadChange: async () => undefined,
    startRun: (path) => { started.push({ path }); },
    openDialog: (_dispatchValue, note) => { opened.push(note); },
    say: (message) => { said.push(message); },
    ...overrides,
  };
  return { host, said, removed, started, opened };
}

describe("fireDueSchedule", () => {
  it("starts a due run on the path the entry named, and consumes the entry", () => {
    const due = entry("demo", "2026-09-09T09:00:00.000Z", "single-stage");
    const { host, said, removed, started, opened } = makeHost({ loadEntries: async () => [due] });

    return fireDueSchedule(host, known, now).then(() => {
      expect(started).toEqual([{ path: "single-stage" }]);
      expect(opened).toEqual([]);
      expect(removed).toEqual([due]);
      expect(said[0]).toContain("Scheduled for");
    });
  });

  it("leaves the entry in the schedule when the run cannot be opened, and names what failed", async () => {
    // The entry used to be removed before the dispatch was resolved, so
    // a malformed harness.json printed "Reading the schedule failed" —
    // which is not what failed — and the run was gone.
    const due = entry("demo", "2026-09-09T09:00:00.000Z");
    const { host, said, removed, started } = makeHost({
      loadEntries: async () => [due],
      resolveDispatch: async () => { throw new Error("harness.json is not valid JSON"); },
    });

    await fireDueSchedule(host, known, now);

    expect(removed).toEqual([]);
    expect(started).toEqual([]);
    expect(said).toEqual([
      "The scheduled run for demo could not be opened: harness.json is not valid JSON",
    ]);
  });

  it("says reading failed only when reading is what failed", async () => {
    const { host, said } = makeHost({
      loadEntries: async () => { throw new Error("scheduled-runs.json is not valid JSON"); },
    });

    await fireDueSchedule(host, known, now);

    expect(said[0]).toContain("Reading the schedule failed");
  });

  it("asks for a choice, saying why, when the stored path is no longer offered", async () => {
    const due = entry("demo", "2026-09-09T09:00:00.000Z", "vscode-agent");
    const { host, started, opened } = makeHost({
      loadEntries: async () => [due],
      resolveDispatch: async () => dispatch(["chain", "single-stage"]),
    });

    await fireDueSchedule(host, known, now);

    expect(started).toEqual([]);
    expect(opened[0]).toContain("configured paths changed");
  });

  it("does not switch the editor away from unsaved edits, and says so on the dialog", async () => {
    // Firing used to point the editor at the change without loading it,
    // so a save posted one change's files under another's name.
    const due = entry("demo", "2026-09-09T09:00:00.000Z");
    const { host, started, opened } = makeHost({
      loadEntries: async () => [due],
      loadChange: async () => "other has unsaved edits, so the editor was left on it.",
    });

    await fireDueSchedule(host, known, now);

    expect(started).toEqual([]);
    expect(opened[0]).toContain("unsaved edits");
  });

  it("drops an archived change, says it was archived, and starts what was behind it", async () => {
    const archived = entry("old", "2026-09-09T08:00:00.000Z");
    const due = entry("demo", "2026-09-09T09:00:00.000Z");
    const { host, said, removed, started } = makeHost({ loadEntries: async () => [archived, due] });

    await fireDueSchedule(host, known, now);

    expect(said[0]).toContain("archived");
    expect(removed).toEqual([archived, due]);
    expect(started).toEqual([{ path: "chain" }]);
  });

  it("does nothing at all on an empty schedule", async () => {
    const resolveDispatch = vi.fn();
    const { host, said } = makeHost({ resolveDispatch });

    await fireDueSchedule(host, known, now);

    expect(resolveDispatch).not.toHaveBeenCalled();
    expect(said).toEqual([]);
  });
});
