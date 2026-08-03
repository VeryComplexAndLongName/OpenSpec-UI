import { describe, expect, it } from "vitest";
import type { Event } from "@openspec-ui/core";
import { describeEvent } from "./describe-event.js";

const base = { runId: "r1", timestamp: "t" };

describe("describeEvent", () => {
  it("formats every event variant", () => {
    const cases: Array<[Event, string]> = [
      [{ ...base, kind: "started", command: "plan", cwd: "/x" }, "[started] plan"],
      [{ ...base, kind: "stdout", chunk: "hello\n" }, "hello\n"],
      [{ ...base, kind: "stderr", chunk: "warn\n" }, "warn\n"],
      [{ ...base, kind: "progress", message: "3/7" }, "[progress] 3/7"],
      [{ ...base, kind: "completed", summary: "diff" }, "[completed] diff"],
      [{ ...base, kind: "completed" }, "[completed]"],
      [{ ...base, kind: "failed", reason: "boom" }, "[failed] boom"],
      [{ ...base, kind: "cancelled" }, "[cancelled]"],
    ];
    for (const [event, expected] of cases) {
      expect(describeEvent(event)).toBe(expected);
    }
  });
});
