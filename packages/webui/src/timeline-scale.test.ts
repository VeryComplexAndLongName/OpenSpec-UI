import { describe, expect, it } from "vitest";
import { logPosition } from "./timeline-scale.js";

const rangeStart = new Date("2026-01-01T00:00:00.000Z").getTime();
const rangeEnd = new Date("2026-01-11T00:00:00.000Z").getTime();

describe("logPosition", () => {
  it("positions the range start at 0", () => {
    expect(logPosition(rangeStart, rangeStart, rangeEnd)).toBe(0);
  });

  it("positions the range end at 100", () => {
    expect(logPosition(rangeEnd, rangeStart, rangeEnd)).toBe(100);
  });

  it("clamps a timestamp before the range start to 0", () => {
    const before = rangeStart - 1000 * 60 * 60 * 24;
    expect(logPosition(before, rangeStart, rangeEnd)).toBe(0);
  });

  it("clamps a timestamp after the range end to 100", () => {
    const after = rangeEnd + 1000 * 60 * 60 * 24;
    expect(logPosition(after, rangeStart, rangeEnd)).toBe(100);
  });

  it("spreads a dense early cluster further apart than a linear scale would", () => {
    const dayMs = 1000 * 60 * 60 * 24;
    const first = rangeStart + dayMs * 0.1;
    const second = rangeStart + dayMs * 0.2;
    const linearGap = ((second - first) / (rangeEnd - rangeStart)) * 100;
    const logGap = logPosition(second, rangeStart, rangeEnd) - logPosition(first, rangeStart, rangeEnd);
    expect(logGap).toBeGreaterThan(linearGap);
  });

  it("compresses a late gap tighter than a linear scale would", () => {
    const dayMs = 1000 * 60 * 60 * 24;
    const first = rangeStart + dayMs * 8;
    const second = rangeStart + dayMs * 9;
    const linearGap = ((second - first) / (rangeEnd - rangeStart)) * 100;
    const logGap = logPosition(second, rangeStart, rangeEnd) - logPosition(first, rangeStart, rangeEnd);
    expect(logGap).toBeLessThan(linearGap);
  });

  it("treats a zero-length range as fully compressed at the start", () => {
    expect(logPosition(rangeStart, rangeStart, rangeStart)).toBe(0);
  });
});
