import { COMMAND_KINDS } from "@openspec-ui/core";
import { describe, expect, it } from "vitest";
import { isCommandLike } from "./wire.js";

function commandOf(kind: string) {
  return { kind, cwd: "/workspace", runId: "run-1", context: { changeDir: "/workspace/openspec/changes/demo" } };
}

describe("isCommandLike", () => {
  it("recognizes every command kind core defines, sourced from the shared COMMAND_KINDS export", () => {
    for (const kind of COMMAND_KINDS) {
      expect(isCommandLike(commandOf(kind))).toBe(true);
    }
  });

  it("rejects a kind core does not define", () => {
    expect(isCommandLike(commandOf("not-a-real-command"))).toBe(false);
  });

  it("rejects a value missing required fields", () => {
    expect(isCommandLike({ kind: "plan" })).toBe(false);
    expect(isCommandLike(null)).toBe(false);
  });
});
