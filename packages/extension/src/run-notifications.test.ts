import { describe, expect, it } from "vitest";
import type { WorkbenchProcess } from "@openspec-ui/core";
import { RunCompletionNotifier, describeRunCompletion } from "./run-notifications.js";

function process(overrides: Partial<WorkbenchProcess> = {}): WorkbenchProcess {
  return {
    id: "p1",
    operation: "implement",
    changeName: "demo-change",
    mutating: true,
    state: "running",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("RunCompletionNotifier", () => {
  it("reports a process that transitions from running to completed", () => {
    const notifier = new RunCompletionNotifier([process({ state: "running" })]);
    const result = notifier.handle([process({ state: "completed", summary: "3/3 tasks" })]);
    expect(result).toEqual([process({ state: "completed", summary: "3/3 tasks" })]);
  });

  it("does not re-report the same process on a later update", () => {
    const notifier = new RunCompletionNotifier([process({ state: "running" })]);
    notifier.handle([process({ state: "completed" })]);
    const result = notifier.handle([process({ state: "completed" })]);
    expect(result).toEqual([]);
  });

  it("does not report a process already terminal when first seen (e.g. restored from the journal)", () => {
    const notifier = new RunCompletionNotifier([process({ state: "completed" })]);
    const result = notifier.handle([process({ state: "completed" })]);
    expect(result).toEqual([]);
  });

  it("does not report status/list/show/validate operations", () => {
    const notifier = new RunCompletionNotifier([process({ operation: "validate", state: "running" })]);
    const result = notifier.handle([process({ operation: "validate", state: "completed" })]);
    expect(result).toEqual([]);
  });

  it("does not report cancelled, interrupted, or rolled-back transitions", () => {
    const notifier = new RunCompletionNotifier([
      process({ id: "a", state: "running" }),
      process({ id: "b", state: "running" }),
      process({ id: "c", state: "running" }),
    ]);
    const result = notifier.handle([
      process({ id: "a", state: "cancelled" }),
      process({ id: "b", state: "interrupted" }),
      process({ id: "c", state: "rolled-back" }),
    ]);
    expect(result).toEqual([]);
  });

  it("reports a failed run", () => {
    const notifier = new RunCompletionNotifier([process({ state: "running" })]);
    const result = notifier.handle([process({ state: "failed", error: "boom" })]);
    expect(result).toEqual([process({ state: "failed", error: "boom" })]);
  });
});

describe("describeRunCompletion", () => {
  it("describes a completed run with the change name and summary", () => {
    expect(describeRunCompletion(process({ state: "completed", summary: "3/3 tasks complete" }))).toBe(
      'OpenSpec UI: implement for "demo-change" completed (3/3 tasks complete).',
    );
  });

  it("describes a failed run with the change name and error", () => {
    expect(describeRunCompletion(process({ state: "failed", error: "agent exited with code 1" }))).toBe(
      'OpenSpec UI: implement for "demo-change" failed (agent exited with code 1).',
    );
  });

  it("omits the change-name clause when absent", () => {
    expect(describeRunCompletion(process({ changeName: undefined, state: "completed" }))).toBe(
      "OpenSpec UI: implement completed.",
    );
  });
});
