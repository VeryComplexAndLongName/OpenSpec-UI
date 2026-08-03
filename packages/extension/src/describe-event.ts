import type { Event } from "@openspec-ui/core";

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
  }
}
