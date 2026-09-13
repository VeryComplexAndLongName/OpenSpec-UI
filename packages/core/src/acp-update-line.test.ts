// an-agent-update-says-something tasks.md 5.5 — one test per row of the
// reader's table in design.md.

import { describe, expect, it } from "vitest";
import { describeAcpUpdate } from "./acp-update-line.js";

describe("describeAcpUpdate", () => {
  it("reads a tool_call as its title", () => {
    expect(
      describeAcpUpdate({ sessionUpdate: "tool_call", toolCallId: "t1", title: "Read src/index.ts", kind: "read" }),
    ).toBe("Read src/index.ts");
  });

  it("reads only the first line of a title, trimmed", () => {
    const title = ["  Bash: npm run test  ", "npm run lint"].join(String.fromCharCode(13, 10));
    expect(describeAcpUpdate({ sessionUpdate: "tool_call", toolCallId: "t1", title })).toBe("Bash: npm run test");
  });

  it("reads nothing from a tool_call with no usable title", () => {
    expect(describeAcpUpdate({ sessionUpdate: "tool_call", toolCallId: "t1" })).toBeUndefined();
    expect(describeAcpUpdate({ sessionUpdate: "tool_call", toolCallId: "t1", title: "   " })).toBeUndefined();
    expect(describeAcpUpdate({ sessionUpdate: "tool_call", toolCallId: "t1", title: 42 })).toBeUndefined();
  });

  it("reads a failed tool_call_update as failed, with its title", () => {
    expect(
      describeAcpUpdate({ sessionUpdate: "tool_call_update", toolCallId: "t1", status: "failed", title: "Bash: npm test" }),
    ).toBe("failed: Bash: npm test");
  });

  it("still says a tool call failed when the update carries no title", () => {
    // A native agent may send only the id and the status. The reader keeps
    // no memory of earlier calls, and a failure is worth a line anyway.
    expect(describeAcpUpdate({ sessionUpdate: "tool_call_update", toolCallId: "t1", status: "failed" })).toBe(
      "a tool call failed",
    );
  });

  it("reads nothing from a tool_call_update that did not fail", () => {
    for (const status of ["completed", "in_progress", "pending", undefined]) {
      expect(
        describeAcpUpdate({ sessionUpdate: "tool_call_update", toolCallId: "t1", status, title: "Read a.ts" }),
      ).toBeUndefined();
    }
  });

  it("reads a plan as its progress and the step in progress", () => {
    expect(
      describeAcpUpdate({
        sessionUpdate: "plan",
        entries: [
          { content: "Read the tasks", priority: "medium", status: "completed" },
          { content: "Write the reader", priority: "medium", status: "in_progress" },
          { content: "Run the tests", priority: "medium", status: "pending" },
        ],
      }),
    ).toBe("plan 1/3: Write the reader");
  });

  it("reads a plan with no step in progress as its progress alone", () => {
    expect(
      describeAcpUpdate({
        sessionUpdate: "plan",
        entries: [
          { content: "Read the tasks", priority: "high", status: "completed" },
          { content: "Run the tests", priority: "low", status: "pending" },
        ],
      }),
    ).toBe("plan 1/2");
  });

  it("reads nothing from an empty or unreadable plan", () => {
    expect(describeAcpUpdate({ sessionUpdate: "plan", entries: [] })).toBeUndefined();
    expect(describeAcpUpdate({ sessionUpdate: "plan" })).toBeUndefined();
    expect(describeAcpUpdate({ sessionUpdate: "plan", entries: ["not an entry"] })).toBeUndefined();
  });

  it("reads nothing from streamed text, which is prose and joined elsewhere", () => {
    expect(
      describeAcpUpdate({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello" } }),
    ).toBeUndefined();
    expect(
      describeAcpUpdate({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "hmm" } }),
    ).toBeUndefined();
  });

  it("reads nothing from a kind it does not recognise, even one with a title", () => {
    expect(describeAcpUpdate({ sessionUpdate: "usage_update", used: 1, size: 2 })).toBeUndefined();
    expect(describeAcpUpdate({ sessionUpdate: "some_future_update", title: "Looks readable" })).toBeUndefined();
    // Claude's own stream-json, forwarded untranslated, is not ACP either.
    expect(describeAcpUpdate({ sessionUpdate: "assistant", message: { content: [] } })).toBeUndefined();
    expect(describeAcpUpdate({ title: "no kind at all" })).toBeUndefined();
  });
});
