import { describeAcpUpdate, readAcpStreamedText, type Event } from "@openspec-ui/core";

export function describeEvent(event: Event): string {
  switch (event.kind) {
    case "started":
      return `[started] ${event.command}`;
    case "stdout":
      return event.chunk;
    case "stderr":
      return event.chunk;
    case "progress":
      return `[progress] ${event.message}`;
    case "completed":
      return event.summary ? `[completed] ${event.summary}` : "[completed]";
    case "failed":
      return `[failed] ${event.reason}`;
    case "cancelled":
      return "[cancelled]";
    case "cancelling":
      return event.attempted === "nothing-to-cancel"
        ? "[cancelling] nothing was running"
        : "[cancelling] asked the agent process to stop";
    case "usageReported":
      return "[usage] reported by the agent";
    case "stageStarted":
      return `[stage started] ${event.stage}${event.agentId ? ` (${event.agentId})` : ""}`;
    case "stageCompleted":
      return `[stage completed] ${event.stage} -> ${event.nextStage}`;
    case "checkpoint":
      return `[checkpoint] ${event.stage} -> ${event.nextStage} (${event.nextAgentId})`;
    case "handedOff":
      return `[handed off] ${event.stage} -> VS Code chat`;
    case "agentUpdate": {
      // Streamed text is shown as the text, the way `stdout` already is; a
      // tool call, a failure or a plan as the line core reads out of it.
      // Only an update neither recognises is still named by its kind.
      const streamed = readAcpStreamedText(event.update);
      if (streamed) return streamed.text;
      const line = describeAcpUpdate(event.update);
      return line ? `[agent] ${line}` : `[agent update] ${String(event.update.sessionUpdate ?? "update")}`;
    }
    case "permissionRequest":
      return `[permission requested] ${event.description}`;
  }
}
