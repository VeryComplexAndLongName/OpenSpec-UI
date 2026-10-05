import { describe, expect, it, vi } from "vitest";
import { describeTaskResult, taskActionsOver } from "./task-actions.js";

// a-card-works-its-own-tasks 3.3: both hosts' answers in the panel's words.
describe("describeTaskResult", () => {
  it("says a tick, a commit, a run and a refusal", () => {
    expect(describeTaskResult({ ok: true, tasksPath: "/t", line: "- [x] 6.4 Look", noteLine: "  Closed by ada" }))
      .toEqual({ ok: true, said: "Written: - [x] 6.4 Look, with the note under it. Commit and push to send it." });
    expect(describeTaskResult({ ok: true, commit: "abcdef1234567", branch: "demo", pushedTo: "origin/demo", message: "tasks(demo): ticked 6.4" }))
      .toEqual({ ok: true, said: 'Committed abcdef12 ("tasks(demo): ticked 6.4") and pushed to origin/demo.' });
    expect(describeTaskResult({ status: "ran", message: "claude-cli ran task 2.1; it is still open." }))
      .toEqual({ ok: true, said: "claude-cli ran task 2.1; it is still open." });
    expect(describeTaskResult({ ok: false, kind: "note-required", reason: "Say what was checked." }))
      .toEqual({ ok: false, said: "Say what was checked." });
  });

  it("never takes an answer it does not recognise for a success", () => {
    expect(describeTaskResult({ ok: true })).toMatchObject({ ok: false });
    expect(describeTaskResult(undefined)).toMatchObject({ ok: false });
  });
});

describe("taskActionsOver", () => {
  it("sends the change, the line, its text and the note, and says a transport failure as one", async () => {
    const request = vi.fn(async () => ({ ok: true, line: "- [x] 1.1 Look" }));
    const actions = taskActionsOver(request, { openTargets: ["tasks"], canRun: false });

    await actions.set("demo", { lineNumber: 4, text: "1.1 Look" }, true, "seen");
    expect(request).toHaveBeenCalledWith("task-set", { changeName: "demo", lineNumber: 4, expectedText: "1.1 Look", done: true, note: "seen" });
    expect(actions.run).toBeUndefined();

    const failing = taskActionsOver(async () => { throw new Error("connection refused"); }, { openTargets: [], canRun: true });
    expect(await failing.commit("demo")).toEqual({ ok: false, said: "connection refused" });
  });
});
