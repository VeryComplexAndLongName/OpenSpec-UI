import { describe, expect, it } from "vitest";
import {
  COMMAND_KINDS,
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
  { ...base, kind: "stageCompleted", stage: "propose", nextStage: "review" },
  {
    ...base,
    kind: "checkpoint",
    stage: "review",
    nextStage: "apply",
    nextAgentId: "claude-cli",
  },
  { ...base, kind: "handedOff", stage: "apply" },
  { ...base, kind: "agentUpdate", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } } },
  { ...base, kind: "permissionRequest", requestId: "perm-1", description: "Write to src/index.ts" },
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
