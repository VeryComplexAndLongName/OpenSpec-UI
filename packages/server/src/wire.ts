// Checking the shape of incoming JSON as a `Command` is a serialization
// boundary (analogous to parsing an HTTP request), not business logic:
// the server does not decide what the agent is permitted to do, it only
// recognizes the request's shape (see spec.md, "Server contains no
// business logic").

import type { Command, CommandKind } from "@openspec-ui/core";

const COMMAND_KINDS: readonly CommandKind[] = [
  "plan",
  "implement",
  "review",
  "status",
  "list",
  "show",
  "validate",
  "cancel",
];

export function isCommandLike(value: unknown): value is Command {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.kind !== "string" || !COMMAND_KINDS.includes(v.kind as CommandKind)) return false;
  if (typeof v.cwd !== "string" || typeof v.runId !== "string") return false;
  if (typeof v.context !== "object" || v.context === null) return false;
  const context = v.context as Record<string, unknown>;
  if (typeof context.changeDir !== "string") return false;
  if (v.agentId !== undefined && typeof v.agentId !== "string") return false;
  return true;
}
