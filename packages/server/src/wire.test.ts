import { COMMAND_KINDS, serializeEvent, type Event } from "@openspec-ui/core";
import { describe, expect, it } from "vitest";
import { isCommandLike } from "./wire.js";

function commandOf(kind: string) {
  return { kind, cwd: "/workspace", runId: "run-1", context: { changeDir: "/workspace/openspec/changes/demo" } };
}

describe("isCommandLike", () => {
  it("round-trips the Harness push request and its permission resolution", () => {
    const event = {
      kind: "permissionRequest", runId: "run-1", timestamp: "t", requestId: "push-1",
      description: "Push abc to origin (https://example.com/repo), refs/heads/feature?",
      pushApproval: { commit: "abc", remote: "origin", repository: "https://example.com/repo", destinationRef: "refs/heads/feature" },
    } satisfies Event;
    const decoded = JSON.parse(serializeEvent(event));
    expect(decoded).toEqual(event);
    const answer = {
      ...commandOf("resolvePermission"), runId: decoded.runId,
      permissionRequestId: decoded.requestId, permissionOutcome: "allow",
    };
    expect(isCommandLike(JSON.parse(JSON.stringify(answer)))).toBe(true);
  });

  it("recognizes every command kind core defines, sourced from the shared COMMAND_KINDS export", () => {
    for (const kind of COMMAND_KINDS) {
      expect(isCommandLike(commandOf(kind))).toBe(true);
    }
    // the-plan-is-updated-from-its-review: the update reaches the runner.
    expect(isCommandLike({ ...commandOf("update"), context: { changeDir: "/workspace/openspec/changes/demo", notes: "keep the API" } })).toBe(true);
  });

  it("rejects a kind core does not define", () => {
    expect(isCommandLike(commandOf("not-a-real-command"))).toBe(false);
  });

  it("rejects a value missing required fields", () => {
    expect(isCommandLike({ kind: "plan" })).toBe(false);
    expect(isCommandLike(null)).toBe(false);
  });
});
