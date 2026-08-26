import type { CommandKind, Event } from "@openspec-ui/core/browser";

/** Agent-driven commands worth a "you can stop watching now" notification —
 * see packages/extension/src/run-notifications.ts for the same filter
 * (and the same reasoning) on the VS Code side. */
export const AGENT_COMMANDS: readonly CommandKind[] = ["plan", "implement", "review"];

export interface RunCompletionNotification {
  title: string;
  body: string;
}

/** Pure — no `Notification` API access here, so this is testable without a
 * browser. The host (standalone-entry.tsx) decides whether/how to actually
 * show it; `AiPanel` itself stays transport- and host-neutral (see ADR
 * 0001) and only reports terminal events for agent commands via its
 * `onRunTerminal` prop. */
export function describeRunCompletionNotification(
  commandKind: CommandKind,
  event: Event,
): RunCompletionNotification | null {
  if (!AGENT_COMMANDS.includes(commandKind)) return null;
  if (event.kind === "completed") {
    return { title: "OpenSpec UI", body: `${commandKind} completed${event.summary ? `: ${event.summary}` : ""}.` };
  }
  if (event.kind === "failed") {
    return { title: "OpenSpec UI", body: `${commandKind} failed: ${event.reason}` };
  }
  return null;
}
