import { describe, expect, it } from "vitest";
import { commandLabel, type Event } from "@openspec-ui/core/browser";
import { describeRunCompletionNotification } from "./notify-run-completion.js";

const base = { runId: "r1", timestamp: "t" };

describe("describeRunCompletionNotification", () => {
  it("describes a completed agent run", () => {
    const event: Event = { ...base, kind: "completed", summary: "3/3 tasks" };
    expect(describeRunCompletionNotification("implement", event)).toEqual({
      title: "OpenSpec Workbench",
      body: "apply completed: 3/3 tasks.",
    });
  });

  it("names a stage as the picker does", () => {
    // one-stage-speaks-openspec: the kind on the wire is `plan`; a person
    // picked "propose".
    expect(commandLabel("plan")).toBe("propose");
    expect(commandLabel("implement")).toBe("apply");
    expect(commandLabel("review")).toBe("review");
    expect(commandLabel("verify")).toBe("verify");
    expect(commandLabel("status")).toBe("status");
    expect(describeRunCompletionNotification("verify", { ...base, kind: "completed" })?.body).toBe("verify completed.");
  });

  it("describes a failed agent run", () => {
    const event: Event = { ...base, kind: "failed", reason: "agent exited with code 1" };
    expect(describeRunCompletionNotification("review", event)).toEqual({
      title: "OpenSpec Workbench",
      body: "review failed: agent exited with code 1",
    });
  });

  it("returns null for a non-agent command", () => {
    const event: Event = { ...base, kind: "completed", summary: "3 changes" };
    expect(describeRunCompletionNotification("list", event)).toBeNull();
  });

  it("returns null for a non-terminal or cancelled event", () => {
    expect(describeRunCompletionNotification("implement", { ...base, kind: "progress", message: "50%" })).toBeNull();
    expect(describeRunCompletionNotification("implement", { ...base, kind: "cancelled" })).toBeNull();
  });
});
