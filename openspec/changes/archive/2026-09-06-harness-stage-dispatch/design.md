## Context

The decision, its constraints and every rejected alternative live in
`docs/adr/0016-harness-stage-dispatch-via-vscode-chat.md` and are not
repeated here. This design covers only how it lands in the code.

Relevant existing shape: `HarnessStepAgent` is `string | { agent: string;
model?: string }` (`harness-step-agent.ts`, added by
`harness-step-models`); `EventKind` currently has nine members
(`protocol.ts:72`); `startImplementation` (`commands.ts`) already shows
the `workbench.action.chat.open` call this reuses.

## Goals / Non-Goals

**Goals:**

- A stage can be handed to VS Code's chat from the harness, and the
  harness says plainly that it was handed off rather than observed.
- Every configuration that cannot work is refused where it is written,
  not where it would fail.

**Non-Goals (this change):**

- Making chains work with chat dispatch. ADR 0016 settles this: there is
  no completion signal, and inferring one is explicitly rejected there.
- Observing, streaming or auditing the chat session's work. Out of reach
  by construction — that is the trade this dispatch makes.
- A UI for choosing dispatch. This change makes the config expressible
  and honoured; a picker control is separate.
- Any other host's chat (Cursor, JetBrains AI). `vscode-chat` names the
  one host this product has an extension for.

## Decisions

### Validation splits between core and the host, because only the host knows the target

Core validates what is knowable from the config alone: the value is one
of two literals, and `"vscode-chat"` requires `autonomyLevel: assisted`.
Core cannot validate the delivery target — it has no idea which host
loaded it — so the standalone server performs that check itself when it
resolves the config, and reports an error.

**Rejected alternative**: pass the target into `resolveHarnessConfig` so
core can do both checks. Rejected — it would put "which delivery target
am I" into a module whose whole point is being host-agnostic, to save one
check in one host.

### A distinct event kind, not `completed`

A handed-off stage emits `started` and then the new kind. It must not
emit `completed`: ADR 0012's contract is that `completed` means the work
completed, and here the work has not even begun — it has been handed to
someone else.

**Rejected alternative**: emit `completed` with a note in the payload.
Rejected — every consumer that branches on terminal kind (the chain
runner, the Processes view's percent, run notifications) would treat the
stage as finished. The whole reason for a distinct kind is that these
consumers must be able to tell the difference.

### The new kind is non-terminal, and the run ends there

Non-terminal, like `stageCompleted`/`checkpoint`, so a client that does
not recognise it still sees a coherent log. The run simply has no
terminal event: nothing will report one, because nothing is watching the
chat. This is stated in the spec so it reads as intended behavior rather
than a dropped event.

## Risks / Trade-offs

- **[Risk]** A user configures `vscode-chat` and later switches the
  change to `semi-autonomous`, making the configuration invalid. →
  **Mitigation**: the autonomy check runs at config read, so the next
  resolution fails with a message naming the stage — before any run
  starts, and in both hosts.
- **[Trade-off]** A harness run is no longer uniformly auditable: a
  chat-dispatched stage produces no `AuditLog` entry, as ADR 0016
  records. Accepted there; noted here so the implementation does not
  quietly invent a synthetic audit record that would misrepresent what
  this product actually observed.
- **[Risk]** The prompt handed to the chat is built by this product, but
  everything after that is outside it — including whether the user ever
  runs it. → **Mitigation**: none available, and none pretended. The
  hand-off event is worded so the UI can say "handed to the chat", not
  "done".

## Migration Plan

No migration. `dispatch` is optional and defaults to `"cli"`; every
existing config keeps its current behavior with no edit.
