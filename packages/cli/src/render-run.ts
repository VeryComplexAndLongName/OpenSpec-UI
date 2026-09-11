// Turning a run's events into what a terminal shows. Presentation only —
// the decisions this renders were all made in core, and nothing here
// changes what happens.
//
// Two formats, from one stream: readable text by default (a run is
// watched, not collected), and one JSON object per line for a machine.
// See openspec/changes/a-change-runs-from-the-terminal/design.md, "Text
// for a person, one JSON object per line for a machine".

import { readAcpStreamedText, type AcpTextChunkKind, type Event } from "@openspec-ui/core";

/** What to write for one event. `text` is written verbatim: a renderer
 * that wants a line break asks for one, because the pieces of a streamed
 * reply must be able to join without one.
 *
 * `undefined` means this event has nothing to show — a terminal is not a
 * protocol log, and an event a reader cannot act on is noise between them
 * and the agent's actual output. */
export type RenderedPiece = string | undefined;

/** Tracks just enough across events to know whether a line is already
 * open. A streamed reply arrives as a run of chunks written with no
 * separator, so the next thing that *is* a line has to know to break
 * first — otherwise a stage heading lands in the middle of a sentence. */
export class RunTextRenderer {
  private lineOpen = false;
  /** Which kind of streamed text is currently being written, so a switch
   * from thinking to speaking breaks the line between them — the same
   * rule `collapseStreamEvents` applies in the panel, for the same
   * reason: they are two statements and running them together shows one
   * that was never made. */
  private streamingKind: AcpTextChunkKind | "stdout" | undefined;

  /** Renders one event, or `undefined` for one with nothing to show. */
  render(event: Event): RenderedPiece {
    switch (event.kind) {
      case "stageStarted": {
        const attempt = event.attempt !== undefined && event.attempt > 1 ? ` (attempt ${event.attempt})` : "";
        const agent = event.agentId ? ` — ${event.agentId}` : "";
        return this.line(`\n▶ ${event.stage}${agent}${attempt}`);
      }
      case "stageCompleted":
        return this.line(`✓ ${event.stage} → ${event.nextStage}`);
      case "handedOff":
        return this.line(`↷ ${event.stage} handed off to the host's own chat`);
      case "stdout":
        return this.streamed(event.chunk, "stdout");
      case "agentUpdate": {
        const text = readAcpStreamedText(event.update);
        if (!text) return undefined;
        return this.streamed(text.text, text.kind);
      }
      case "stderr":
        return this.line(event.chunk.replace(/\r?\n$/, ""));
      case "progress":
        return this.line(`· ${event.message}`);
      case "usageReported": {
        const parts: string[] = [];
        if (event.usage.costUsd !== undefined) parts.push(`$${event.usage.costUsd.toFixed(2)}`);
        const tokens = (event.usage.inputTokens ?? 0) + (event.usage.outputTokens ?? 0);
        if (event.usage.inputTokens !== undefined || event.usage.outputTokens !== undefined) {
          // Pinned locale, not the machine's: this output is read out of
          // CI logs and compared between machines, and a thousands
          // separator that changes with the host's locale makes two runs
          // of the same chain look different.
          parts.push(`${tokens.toLocaleString("en-US")} tokens`);
        }
        return parts.length > 0 ? this.line(`· reported ${parts.join(", ")}`) : undefined;
      }
      case "cancelling":
        return this.line(
          event.attempted === "termination-requested"
            ? "· cancelling: asked the agent's process tree to stop"
            : "· cancelling: nothing was running",
        );
      case "completed":
        return this.line(`\n✓ ${event.summary ?? "completed"}`);
      case "failed":
        return this.line(`\n✗ ${event.reason}`);
      case "cancelled":
        return this.line(`\n■ cancelled${event.reason ? `: ${event.reason}` : ""}`);
      // `started` announces a stage the chain already announced through
      // `stageStarted`, and `checkpoint`/`permissionRequest` are answered
      // rather than printed — the caller asks the question itself,
      // because it is the one that has to read the answer.
      default:
        return undefined;
    }
  }

  /** Closes an open line, for a caller finishing its output. */
  finish(): RenderedPiece {
    if (!this.lineOpen) return undefined;
    this.lineOpen = false;
    this.streamingKind = undefined;
    return "\n";
  }

  private line(text: string): string {
    const prefix = this.lineOpen ? "\n" : "";
    this.lineOpen = false;
    this.streamingKind = undefined;
    return `${prefix}${text}\n`;
  }

  private streamed(text: string, kind: AcpTextChunkKind | "stdout"): RenderedPiece {
    if (text.length === 0) return undefined;
    const prefix = this.lineOpen && this.streamingKind !== kind ? "\n" : "";
    this.lineOpen = !text.endsWith("\n");
    this.streamingKind = kind;
    return `${prefix}${text}`;
  }
}

/** One event as its own line of JSON. Never an array: an array cannot be
 * written until the run ends, and a CI log that shows nothing for nine
 * minutes and then everything is the failure this format exists to
 * avoid. */
export function renderRunEventAsJsonLine(event: Event): string {
  return `${JSON.stringify(event)}\n`;
}
