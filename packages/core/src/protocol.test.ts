import { describe, expect, it } from "vitest";
import {
  COMMAND_KINDS,
  type Event,
  type EventKind,
  deserializeEvent,
  isEvent,
  serializeEvent,
} from "./protocol.js";

const base = { runId: "run-1", timestamp: "2026-08-03T00:00:00.000Z" };

// One valid sample per event kind, typed as a Record over `EventKind` so
// that adding a kind without adding a sample here is a COMPILE error.
// That is the only mechanism in this file that does not depend on someone
// remembering: `isEvent`'s switch ends in `default: return false`, so a
// new kind compiles cleanly while the guard silently rejects it — the gap
// `cancelling` and `usageReported` each went through, one after the
// other, each time leaving a shipped feature inert over both transports.
const sampleByKind: Record<EventKind, Event> = {
  started: { ...base, kind: "started", command: "implement", cwd: "/workspace/repo" },
  stdout: { ...base, kind: "stdout", chunk: "some output\n" },
  stderr: { ...base, kind: "stderr", chunk: "warning: something\n" },
  progress: { ...base, kind: "progress", message: "applying task 3/7" },
  completed: { ...base, kind: "completed", summary: "diff --git a/x b/x" },
  failed: { ...base, kind: "failed", reason: "allowlist rejected command" },
  cancelled: { ...base, kind: "cancelled" },
  cancelling: { ...base, kind: "cancelling", attempted: "termination-requested" },
  usageReported: { ...base, kind: "usageReported", usage: { inputTokens: 10, outputTokens: 4, costUsd: 0.26 } },
  stageStarted: { ...base, kind: "stageStarted", stage: "propose", agentId: "claude-cli" },
  stageCompleted: { ...base, kind: "stageCompleted", stage: "propose", nextStage: "review" },
  checkpoint: {
    ...base,
    kind: "checkpoint",
    stage: "review",
    nextStage: "apply",
    nextAgentId: "claude-cli",
  },
  handedOff: { ...base, kind: "handedOff", stage: "apply" },
  agentUpdate: {
    ...base,
    kind: "agentUpdate",
    update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } },
  },
  permissionRequest: { ...base, kind: "permissionRequest", requestId: "perm-1", description: "Write to src/index.ts" },
};

const samples: Event[] = [
  ...Object.values(sampleByKind),
  // Variants beyond the one-per-kind record above.
  { ...base, kind: "completed" },
];

describe("protocol Event serialization", () => {
  for (const sample of samples) {
    it(`round-trips ${sample.kind}`, () => {
      const raw = serializeEvent(sample);
      const parsed = deserializeEvent(raw);
      expect(parsed).toEqual(sample);
    });
  }

  it("accepts every kind the protocol defines", () => {
    // Every entry, not just the ones a previous author remembered: the
    // record's type makes the list exhaustive, and this walks it. An
    // event kind the core can emit but `isEvent` rejects is discarded by
    // both webui transports without an error anywhere.
    for (const [kind, sample] of Object.entries(sampleByKind)) {
      expect(isEvent(sample), `isEvent rejected a valid "${kind}" event`).toBe(true);
    }
  });

  it("rejects a cancelling event whose attempted value is not one of the two permitted", () => {
    expect(isEvent({ ...base, kind: "cancelling", attempted: "termination-requested" })).toBe(true);
    expect(isEvent({ ...base, kind: "cancelling", attempted: "nothing-to-cancel" })).toBe(true);
    expect(isEvent({ ...base, kind: "cancelling", attempted: "maybe" })).toBe(false);
    expect(isEvent({ ...base, kind: "cancelling" })).toBe(false);
  });

  it("rejects a usageReported event carrying no usage object", () => {
    expect(isEvent({ ...base, kind: "usageReported", usage: {} })).toBe(true);
    expect(isEvent({ ...base, kind: "usageReported" })).toBe(false);
    expect(isEvent({ ...base, kind: "usageReported", usage: null })).toBe(false);
    expect(isEvent({ ...base, kind: "usageReported", usage: "0.26" })).toBe(false);
  });

  it("rejects unknown kind", () => {
    expect(() => deserializeEvent(JSON.stringify({ ...base, kind: "bogus" }))).toThrow();
  });

  it("rejects malformed payloads via isEvent", () => {
    expect(isEvent(null)).toBe(false);
    expect(isEvent({})).toBe(false);
    expect(isEvent({ ...base, kind: "stdout" })).toBe(false);
    expect(isEvent({ ...base, kind: "started", command: "implement" })).toBe(false);
  });

  it("rejects malformed stageCompleted/checkpoint payloads", () => {
    expect(isEvent({ ...base, kind: "stageCompleted", nextStage: "review" })).toBe(false);
    expect(isEvent({ ...base, kind: "stageCompleted", stage: "propose" })).toBe(false);
    expect(
      isEvent({ ...base, kind: "stageCompleted", stage: "propose", nextStage: "not-a-stage" }),
    ).toBe(false);
    expect(
      isEvent({ ...base, kind: "checkpoint", stage: "review", nextStage: "apply" }),
    ).toBe(false);
    expect(
      isEvent({
        ...base,
        kind: "checkpoint",
        stage: "review",
        nextStage: "apply",
        nextAgentId: 42,
      }),
    ).toBe(false);
  });

  it("accepts handedOff and rejects it with a missing or invalid stage", () => {
    expect(isEvent({ ...base, kind: "handedOff", stage: "apply" })).toBe(true);
    expect(isEvent({ ...base, kind: "handedOff" })).toBe(false);
    expect(isEvent({ ...base, kind: "handedOff", stage: "not-a-stage" })).toBe(false);
  });

  it("accepts well-formed agentUpdate and rejects a missing/non-object update", () => {
    expect(isEvent({ ...base, kind: "agentUpdate", update: { sessionUpdate: "plan" } })).toBe(true);
    expect(isEvent({ ...base, kind: "agentUpdate" })).toBe(false);
    expect(isEvent({ ...base, kind: "agentUpdate", update: "not-an-object" })).toBe(false);
    expect(isEvent({ ...base, kind: "agentUpdate", update: null })).toBe(false);
  });

  it("accepts well-formed permissionRequest and rejects a missing requestId/description", () => {
    expect(isEvent({ ...base, kind: "permissionRequest", requestId: "perm-1", description: "Write to x" })).toBe(true);
    expect(isEvent({ ...base, kind: "permissionRequest", description: "Write to x" })).toBe(false);
    expect(isEvent({ ...base, kind: "permissionRequest", requestId: "perm-1" })).toBe(false);
    expect(isEvent({ ...base, kind: "permissionRequest", requestId: 42, description: "Write to x" })).toBe(false);
  });
});

describe("COMMAND_KINDS", () => {
  it("contains 'verify' and 'resolvePermission', additive alongside every previously present kind", () => {
    expect(COMMAND_KINDS).toContain("verify");
    expect(COMMAND_KINDS).toContain("resolvePermission");
    for (const kind of ["plan", "implement", "review", "status", "list", "show", "validate", "cancel", "chain", "confirmCheckpoint"]) {
      expect(COMMAND_KINDS).toContain(kind);
    }
  });
});
