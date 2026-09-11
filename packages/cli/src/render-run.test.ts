import { describe, expect, it } from "vitest";
import type { Event } from "@openspec-ui/core";
import { RunTextRenderer, renderRunEventAsJsonLine } from "./render-run.js";

const at = "2026-09-11T00:00:00.000Z";

function chunkEvent(text: string, kind: "agent_message_chunk" | "agent_thought_chunk"): Event {
  return {
    kind: "agentUpdate",
    runId: "r",
    timestamp: at,
    update: { sessionUpdate: kind, content: { type: "text", text } },
  };
}

/** Everything the renderer wrote, as one string — which is what the
 * terminal actually shows, and the only level at which "the word is not
 * broken" can be asserted. */
function render(events: Event[]): string {
  const renderer = new RunTextRenderer();
  const pieces = events.map((event) => renderer.render(event)).filter((piece) => piece !== undefined);
  const tail = renderer.finish();
  return [...pieces, ...(tail === undefined ? [] : [tail])].join("");
}

describe("RunTextRenderer", () => {
  it("joins a streamed reply with nothing between the slices", () => {
    const output = render([
      chunkEvent("I'll inspect the change dir", "agent_message_chunk"),
      chunkEvent("ectory and report back.", "agent_message_chunk"),
    ]);

    // The slice boundary fell inside "directory"; a separator there is
    // the fragmentation this exists to remove, not a fix for it.
    expect(output).toContain("I'll inspect the change directory and report back.");
  });

  it("keeps thinking and speaking apart", () => {
    const output = render([
      chunkEvent("Let me look at the config", "agent_thought_chunk"),
      chunkEvent("The config sets autonomyLevel.", "agent_message_chunk"),
    ]);

    expect(output).toContain("config\nThe config");
  });

  it("breaks the line before a stage heading lands mid-sentence", () => {
    const output = render([
      chunkEvent("half a sen", "agent_message_chunk"),
      { kind: "stageCompleted", runId: "r", timestamp: at, stage: "propose", nextStage: "review" },
    ]);

    expect(output).toContain("half a sen\n");
    expect(output).toContain("✓ propose → review");
  });

  it("names the stage and the agent that runs it", () => {
    const output = render([
      { kind: "stageStarted", runId: "r", timestamp: at, stage: "apply", agentId: "claude-cli" },
    ]);

    expect(output).toContain("▶ apply — claude-cli");
  });

  it("says which attempt a repeated stage is on", () => {
    const output = render([
      { kind: "stageStarted", runId: "r", timestamp: at, stage: "apply", agentId: "claude-cli", attempt: 2 },
    ]);

    expect(output).toContain("attempt 2");
  });

  it("shows nothing for an update it does not recognise as text", () => {
    const renderer = new RunTextRenderer();

    const piece = renderer.render({
      kind: "agentUpdate",
      runId: "r",
      timestamp: at,
      update: { sessionUpdate: "tool_call", title: "Read file" },
    });

    // ACP is not ours and the payload is passed through verbatim —
    // guessing at an unfamiliar shape turns a protocol addition into
    // mangled output.
    expect(piece).toBeUndefined();
  });

  it("ends a run of slices at anything that is not one", () => {
    const output = render([
      chunkEvent("First sentence.", "agent_message_chunk"),
      { kind: "progress", runId: "r", timestamp: at, message: "reading tasks.md" },
      chunkEvent("Second sentence.", "agent_message_chunk"),
    ]);

    const lines = output.split("\n").filter((line) => line.length > 0);
    expect(lines).toEqual(["First sentence.", "· reading tasks.md", "Second sentence."]);
  });

  it("reports what a stage said it spent", () => {
    const output = render([
      { kind: "usageReported", runId: "r", timestamp: at, usage: { costUsd: 0.42, inputTokens: 1000, outputTokens: 500 } },
    ]);

    expect(output).toContain("$0.42");
    expect(output).toContain("1,500 tokens");
  });

  it("closes an open line when the run ends", () => {
    const output = render([chunkEvent("no trailing newline", "agent_message_chunk")]);

    expect(output.endsWith("\n")).toBe(true);
  });
});

describe("renderRunEventAsJsonLine", () => {
  it("writes one complete, parseable line per event", () => {
    const line = renderRunEventAsJsonLine({ kind: "stdout", runId: "r", timestamp: at, chunk: "text\nwith a newline" });

    expect(line.endsWith("\n")).toBe(true);
    // The newline inside the payload must not end the line: a consumer
    // reading line by line would otherwise get half an object.
    expect(line.split("\n").filter((part) => part.length > 0)).toHaveLength(1);
    expect(JSON.parse(line)).toMatchObject({ kind: "stdout", chunk: "text\nwith a newline" });
  });
});
