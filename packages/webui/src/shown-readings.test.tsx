import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { READING_SHOWN_AFTER_MS, useShownReadings } from "./shown-readings.js";

type Readings = { processes: string | null; overview: string | null };
const SETTLED: Readings = { processes: null, overview: null };

function track(initial: Readings) {
  return renderHook(({ readings }: { readings: Readings }) => useShownReadings(readings), { initialProps: { readings: initial } });
}

// a-screen-says-what-it-is-doing 3.18
describe("useShownReadings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never shows a reading that returns before the delay, so a quick Review does not jerk the screen", () => {
    const { result, rerender } = track(SETTLED);

    rerender({ readings: { ...SETTLED, processes: "Reading the run's details…" } });
    expect(result.current.processes).toBeNull();
    act(() => {
      vi.advanceTimersByTime(READING_SHOWN_AFTER_MS - 100);
    });
    rerender({ readings: SETTLED });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current.processes).toBeNull();
  });

  it("shows a reading that outlasts the delay, and stops at once when it returns", () => {
    const { result, rerender } = track(SETTLED);

    rerender({ readings: { ...SETTLED, overview: "Reading the workspace's changes and specs…" } });
    act(() => {
      vi.advanceTimersByTime(READING_SHOWN_AFTER_MS);
    });
    expect(result.current.overview).toBe("Reading the workspace's changes and specs…");
    expect(result.current.processes).toBeNull();

    rerender({ readings: SETTLED });
    expect(result.current.overview).toBeNull();
  });

  it("follows a new sentence at once while a reading is already shown", () => {
    const { result, rerender } = track({ ...SETTLED, processes: "Reading persisted runs…" });
    act(() => {
      vi.advanceTimersByTime(READING_SHOWN_AFTER_MS);
    });

    rerender({ readings: { ...SETTLED, processes: "Removing old history…" } });

    expect(result.current.processes).toBe("Removing old history…");
  });
});
