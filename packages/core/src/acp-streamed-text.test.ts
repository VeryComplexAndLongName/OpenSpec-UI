// acp-text-reads-as-prose tasks.md 3.1 — text read from a message chunk,
// from a thought chunk, and absent from a tool-call update, a usage
// update and an update of an unfamiliar shape.
//
// The payloads here are the shapes agents/acp-session-driver.test.ts
// actually drives its mocked ACP peer with, so this file and the driver
// agree on what an `agentUpdate`'s `update` looks like.

import { describe, expect, it } from "vitest";
import { readAcpStreamedText, withAcpStreamedText } from "./acp-streamed-text.js";

describe("readAcpStreamedText", () => {
  it("reads the text of an agent_message_chunk", () => {
    expect(
      readAcpStreamedText({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello" } }),
    ).toEqual({ kind: "agent_message_chunk", text: "hello" });
  });

  it("reads the text of an agent_thought_chunk, reporting it as a different kind", () => {
    expect(
      readAcpStreamedText({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "thinking" } }),
    ).toEqual({ kind: "agent_thought_chunk", text: "thinking" });
  });

  it("reads no text from a tool_call update", () => {
    expect(
      readAcpStreamedText({ sessionUpdate: "tool_call", toolCallId: "tool-1", title: "Write to src/index.ts" }),
    ).toBeUndefined();
  });

  it("reads no text from a usage_update", () => {
    expect(
      readAcpStreamedText({
        sessionUpdate: "usage_update",
        used: 90_000,
        size: 200_000,
        cost: { amount: 0.42, currency: "USD" },
      }),
    ).toBeUndefined();
  });

  it("reads no text from an update whose kind it does not recognise, even when that update carries text", () => {
    // ACP is not this project's protocol and the payload is carried
    // verbatim. An addition to it must degrade to today's rendering, not
    // to text folded into somebody else's sentence.
    expect(
      readAcpStreamedText({ sessionUpdate: "some_future_chunk", content: { type: "text", text: "hello" } }),
    ).toBeUndefined();
    expect(readAcpStreamedText({ content: { type: "text", text: "hello" } })).toBeUndefined();
  });

  it("reads no text from a recognised kind whose content is not a text block", () => {
    expect(readAcpStreamedText({ sessionUpdate: "agent_message_chunk" })).toBeUndefined();
    expect(
      readAcpStreamedText({ sessionUpdate: "agent_message_chunk", content: { type: "image", data: "..." } }),
    ).toBeUndefined();
    // A future content variant that happens to have a `text` property is
    // not prose either — `type` is what says so.
    expect(
      readAcpStreamedText({ sessionUpdate: "agent_message_chunk", content: { type: "resource_link", text: "a.ts" } }),
    ).toBeUndefined();
    expect(readAcpStreamedText({ sessionUpdate: "agent_message_chunk", content: "hello" })).toBeUndefined();
  });

  it("reads the empty string as text, not as an absence", () => {
    expect(readAcpStreamedText({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "" } })).toEqual({
      kind: "agent_message_chunk",
      text: "",
    });
  });
});

describe("withAcpStreamedText", () => {
  it("replaces the text and keeps everything else the payload carried", () => {
    const update = {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "half a sen" },
      meta: { index: 3 },
    };

    expect(withAcpStreamedText(update, "half a sentence")).toEqual({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "half a sentence" },
      meta: { index: 3 },
    });
  });

  it("does not mutate the update it was given, nor its content block", () => {
    const content = { type: "text", text: "first" };
    const update = { sessionUpdate: "agent_message_chunk", content };

    const joined = withAcpStreamedText(update, "first second");

    expect(update.content).toBe(content);
    expect(content.text).toBe("first");
    expect(joined).not.toBe(update);
    expect(joined?.content).not.toBe(content);
  });

  it("returns undefined for an update carrying no streamed text to replace", () => {
    expect(withAcpStreamedText({ sessionUpdate: "tool_call", toolCallId: "tool-1" }, "anything")).toBeUndefined();
  });
});
