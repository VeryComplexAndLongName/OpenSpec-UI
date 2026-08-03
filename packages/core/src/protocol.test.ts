import { describe, expect, it } from "vitest";
import {
  type Event,
  deserializeEvent,
  isEvent,
  serializeEvent,
} from "./protocol.js";

const base = { runId: "run-1", timestamp: "2026-08-03T00:00:00.000Z" };

const samples: Event[] = [
  { ...base, kind: "started", command: "implement", cwd: "/workspace/repo" },
  { ...base, kind: "stdout", chunk: "some output\n" },
  { ...base, kind: "stderr", chunk: "warning: something\n" },
  { ...base, kind: "progress", message: "applying task 3/7" },
  { ...base, kind: "completed", summary: "diff --git a/x b/x" },
  { ...base, kind: "completed" },
  { ...base, kind: "failed", reason: "allowlist rejected command" },
  { ...base, kind: "cancelled" },
];

describe("protocol Event serialization", () => {
  for (const sample of samples) {
    it(`round-trips ${sample.kind}`, () => {
      const raw = serializeEvent(sample);
      const parsed = deserializeEvent(raw);
      expect(parsed).toEqual(sample);
    });
  }

  it("rejects unknown kind", () => {
    expect(() => deserializeEvent(JSON.stringify({ ...base, kind: "bogus" }))).toThrow();
  });

  it("rejects malformed payloads via isEvent", () => {
    expect(isEvent(null)).toBe(false);
    expect(isEvent({})).toBe(false);
    expect(isEvent({ ...base, kind: "stdout" })).toBe(false);
    expect(isEvent({ ...base, kind: "started", command: "implement" })).toBe(false);
  });
});
