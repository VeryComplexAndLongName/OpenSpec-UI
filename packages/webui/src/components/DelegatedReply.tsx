// The latest reply a delegated run left, beneath the item it answers
// (a-change-says-where-it-stands, ADR 0028's amendment of 2026-09-13).
//
// Shown whatever the outcome: a run that leaves its item open is exactly
// the one whose last words someone needs to read.

import { describeMessageOutcome, type ItemReply } from "@openspec-ui/core/browser";

export function DelegatedReply({ reply, testId }: { reply: ItemReply; testId: string }) {
  return (
    <details className="openspec-delegated-stderr" data-testid={testId}>
      <summary>{`The agent's last reply: it ${describeMessageOutcome(reply.outcome)} (${new Date(reply.at).toLocaleString()})`}</summary>
      <pre>{reply.body}</pre>
    </details>
  );
}
