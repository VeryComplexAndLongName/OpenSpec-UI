import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangeReadinessReport, ChangeStandings, SurveyedRun, WorktreeSurvey } from "@openspec-ui/core/browser";
import { useStandingStates } from "./standing-states.js";

// the-changes-views-see-a-run-start 3.2: the standalone Changes list reads
// the runs again while it is shown, and never the standings.

const INTERVAL = 30_000;
const READ_AT = new Date("2026-09-17T12:00:00.000Z");

const STANDINGS: ChangeStandings = {
  readAt: READ_AT.toISOString(),
  standings: [{ changeName: "demo", here: { label: "repo", path: "/repo", counts: { done: 0, total: 2 }, runs: [] }, elsewhere: [] }],
  sources: { fetch: { attempted: false }, pullRequests: { read: true } },
};

function run(): SurveyedRun {
  return {
    instanceId: "i1",
    changeName: "demo",
    stage: "apply",
    activity: "running apply",
    activitySinceMs: 0,
    heartbeatAgeMs: 0,
    activityAt: READ_AT.toISOString(),
    heartbeatAt: READ_AT.toISOString(),
    gone: false,
    workingDirectory: "/repo",
    runId: "r1",
    waiting: null,
    signature: "unverified",
  };
}

function survey(runs: SurveyedRun[]): WorktreeSurvey {
  return {
    directories: [{ path: "/repo", label: "repo", labelDeclared: false, isMain: true, isThis: true, runs, readable: true, changes: [], authorDiffers: false }],
    runsElsewhere: [],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(READ_AT.getTime() + 1_000));
});

afterEach(() => {
  vi.useRealTimers();
});

// a-blocked-change-says-so-where-it-is-listed 2.3, reported by DW: the list
// read Ready for a change the graph called blocked, because the word was
// asked for without the readiness fact.
describe("useStandingStates - the declared order", () => {
  const READINESS: ChangeReadinessReport = {
    changes: [{
      changeName: "demo",
      run: { state: "blocked", blockedBy: ["apply-plan-stays-pending"] },
      blockers: ["apply-plan-stays-pending"],
      capabilities: [],
    }],
  } as unknown as ChangeReadinessReport;

  it("says a change is blocked, and names what blocks it", () => {
    const loadSurvey = vi.fn<() => Promise<WorktreeSurvey>>().mockResolvedValue(survey([]));

    const { result } = renderHook(() => useStandingStates(STANDINGS, true, loadSurvey, INTERVAL, READINESS));

    expect(result.current.states?.get("demo")?.word).toBe("Blocked by apply-plan-stays-pending");
  });

  it("reads Ready where readiness has not been read", () => {
    const loadSurvey = vi.fn<() => Promise<WorktreeSurvey>>().mockResolvedValue(survey([]));

    const { result } = renderHook(() => useStandingStates(STANDINGS, true, loadSurvey, INTERVAL, null));

    expect(result.current.states?.get("demo")?.word).toBe("Ready");
  });
});

describe("useStandingStates", () => {
  it("turns Ready into Running when a later survey has a run on the change, and keeps it when a survey fails", async () => {
    const loadSurvey = vi.fn<() => Promise<WorktreeSurvey>>()
      .mockResolvedValueOnce(survey([]))
      .mockResolvedValueOnce(survey([run()]))
      .mockRejectedValueOnce(new Error("the server did not answer"));
    const { result } = renderHook(() => useStandingStates(STANDINGS, true, loadSurvey, INTERVAL));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.states?.get("demo")?.word).toBe("Ready");

    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL); });
    expect(result.current.states?.get("demo")?.word).toBe("Running");

    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL); });
    expect(loadSurvey).toHaveBeenCalledTimes(3);
    expect(result.current.states?.get("demo")?.word).toBe("Running");
  });

  it("reads nothing while the list is not shown, or before standings are read", async () => {
    const loadSurvey = vi.fn(async () => survey([run()]));
    const { result, rerender } = renderHook(
      ({ standings, isActive }: { standings: ChangeStandings | null; isActive: boolean }) => useStandingStates(standings, isActive, loadSurvey, INTERVAL),
      { initialProps: { standings: null as ChangeStandings | null, isActive: true } },
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL); });
    expect(result.current.states).toBeUndefined();

    rerender({ standings: STANDINGS, isActive: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVAL); });
    expect(loadSurvey).not.toHaveBeenCalled();
    expect(result.current.states?.get("demo")?.word).toBe("Ready");
  });

  it("does not lay a survey asked for before the standings were read over them", async () => {
    vi.setSystemTime(new Date(READ_AT.getTime() - 5_000));
    const loadSurvey = vi.fn(async () => survey([run()]));
    const { result } = renderHook(() => useStandingStates(STANDINGS, true, loadSurvey, INTERVAL));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.states?.get("demo")?.word).toBe("Ready");
  });
});
