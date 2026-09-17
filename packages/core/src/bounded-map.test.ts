import { describe, expect, it } from "vitest";
import { mapBounded } from "./bounded-map.js";

// the-pipeline-reads-each-workspace-once 1.6. No filesystem and no process:
// promises resolved on a timer of a few milliseconds.

function later<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

describe("mapBounded", () => {
  it("returns every result in the items' order, whichever finishes first", async () => {
    const results = await mapBounded([30, 5, 20, 1], 2, (ms, index) => later(`${index}:${ms}`, ms));
    expect(results).toEqual(["0:30", "1:5", "2:20", "3:1"]);
  });

  it("never runs more than its limit at once", async () => {
    let running = 0;
    let most = 0;
    await mapBounded(Array.from({ length: 20 }, (_, index) => index), 4, async (index) => {
      running += 1;
      most = Math.max(most, running);
      await later(undefined, (index % 3) + 1);
      running -= 1;
    });
    expect(most).toBe(4);
  });

  it("rejects with the first failure and starts nothing after it", async () => {
    const started: number[] = [];
    await expect(mapBounded([0, 1, 2, 3, 4], 1, async (index) => {
      started.push(index);
      if (index === 1) throw new Error("the second failed");
      return index;
    })).rejects.toThrow("the second failed");
    expect(started).toEqual([0, 1]);
  });

  it("maps an empty list to an empty list, and treats a limit below one as one", async () => {
    expect(await mapBounded([], 8, async () => 1)).toEqual([]);
    expect(await mapBounded([1, 2], 0, async (value) => value * 2)).toEqual([2, 4]);
  });
});
