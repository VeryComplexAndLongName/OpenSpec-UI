import { describe, expect, it } from "vitest";
import type { Event } from "@openspec-ui/core/browser";
import { describeRunCompletionNotification } from "./notify-run-completion.js";

const base = { runId: "r1", timestamp: "t" };

describe("describeRunCompletionNotification", () => {
  it("describes a completed agent run", () => {
    const event: Event = { ...base, kind: "completed", summary: "3/3 tasks" };
    expect(describeRunCompletionNotification("implement", event)).toEqual({
      title: "OpenSpec UI",
      body: "implement completed: 3/3 tasks.",
    });
  });

  it("describes a failed agent run", () => {
    const event: Event = { ...base, kind: "failed", reason: "agent exited with code 1" };
    expect(describeRunCompletionNotification("review", event)).toEqual({
      title: "OpenSpec UI",
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
