// Which readings are shown, as opposed to outstanding
// (a-screen-says-what-it-is-doing 3.17).
//
// Most readings return within a few hundred milliseconds. Shown at once,
// each one put a status line above the tab and took it away again, and
// every row's Review in Processes and Recovery jerked the whole screen —
// the owner's report of 2026-09-16. A reading is shown only once it has
// lasted `READING_SHOWN_AFTER_MS`, and stops being shown the moment it
// returns. A wait that short needs no indicator; one longer than it gets the
// full one.

import { useEffect, useRef, useState } from "react";

export const READING_SHOWN_AFTER_MS = 400;

export function useShownReadings<T extends Record<string, string | null>>(readings: T, delayMs = READING_SHOWN_AFTER_MS): T {
  /** When each outstanding reading started, by key. */
  const since = useRef(new Map<string, number>());
  const latest = useRef(readings);
  latest.current = readings;
  const [, setTick] = useState(0);
  // Which keys are reading, and nothing else: a sentence changing while it
  // is shown needs no new timer.
  const signature = Object.entries(readings).map(([key, reading]) => `${key}:${reading === null ? 0 : 1}`).join("|");

  useEffect(() => {
    const now = Date.now();
    let nextDue = Number.POSITIVE_INFINITY;
    for (const [key, reading] of Object.entries(latest.current)) {
      if (reading === null) {
        since.current.delete(key);
        continue;
      }
      if (!since.current.has(key)) since.current.set(key, now);
      const due = (since.current.get(key) ?? now) + delayMs - now;
      if (due > 0) nextDue = Math.min(nextDue, due);
    }
    if (nextDue === Number.POSITIVE_INFINITY) return;
    const timer = setTimeout(() => setTick((tick) => tick + 1), nextDue);
    return () => clearTimeout(timer);
  }, [signature, delayMs]);

  const now = Date.now();
  return Object.fromEntries(Object.entries(readings).map(([key, reading]) => {
    const started = since.current.get(key);
    return [key, reading !== null && started !== undefined && now - started >= delayMs ? reading : null];
  })) as T;
}
