import { describe, expect, it } from "vitest";
import type { Event } from "@openspec-ui/core";
import { describeEvent } from "./describe-event.js";

const base = { runId: "r1", timestamp: "t" };

describe("describeEvent", () => {
  it("formats every event variant", () => {
    const cases: Array<[Event, string | undefined]> = [
      [{ ...base, kind: "started", command: "plan", cwd: "/x" }, "[started] plan"],
      [{ ...base, kind: "stdout", chunk: "hello\n" }, "hello\n"],
      [{ ...base, kind: "stderr", chunk: "warn\n" }, "warn\n"],
      [{ ...base, kind: "progress", message: "3/7" }, "[progress] 3/7"],
      [{ ...base, kind: "completed", summary: "diff" }, "[completed] diff"],
      [{ ...base, kind: "completed" }, "[completed]"],
      [{ ...base, kind: "failed", reason: "boom" }, "[failed] boom"],
      [{ ...base, kind: "cancelled" }, "[cancelled]"],
      // Nothing a person can read: not shown at all, rather than named by
      // its kind — an-agent-update-says-something tasks.md 4.6.
      [{ ...base, kind: "agentUpdate", update: { sessionUpdate: "plan" } }, undefined],
      [{ ...base, kind: "agentUpdate", update: { sessionUpdate: "usage_update", used: 1, size: 2 } }, undefined],
      [{ ...base, kind: "agentUpdate", update: { sessionUpdate: "system", subtype: "init" } }, undefined],
      [
        {
          ...base,
          kind: "agentUpdate",
          update: { sessionUpdate: "tool_call_update", toolCallId: "t1", status: "completed", title: "Read a.ts" },
        },
        undefined,
      ],
      [
        {
          ...base,
          kind: "agentUpdate",
          update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Reading the tasks." } },
        },
        "Reading the tasks.",
      ],
      [
        {
          ...base,
          kind: "agentUpdate",
          update: { sessionUpdate: "tool_call", toolCallId: "t1", title: "Edit src/index.ts", kind: "edit" },
        },
        "[agent] Edit src/index.ts",
      ],
      [
        {
          ...base,
          kind: "agentUpdate",
          update: { sessionUpdate: "tool_call_update", toolCallId: "t1", status: "failed", title: "Bash: npm test" },
        },
        "[agent] failed: Bash: npm test",
      ],
      [
        {
          ...base,
          kind: "agentUpdate",
          update: {
            sessionUpdate: "plan",
            entries: [
              { content: "Read", priority: "medium", status: "completed" },
              { content: "Write", priority: "medium", status: "in_progress" },
            ],
          },
        },
        "[agent] plan 1/2: Write",
      ],
      [
        { ...base, kind: "permissionRequest", requestId: "perm-1", description: "Write to x" },
        "[permission requested] Write to x",
      ],
    ];
    for (const [event, expected] of cases) {
      expect(describeEvent(event)).toBe(expected);
    }
  });
});
