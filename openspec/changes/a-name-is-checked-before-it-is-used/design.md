# Design

## Decision: the check lives where the path is built

`changeHarnessConfigPath` calls `assertValidChangeName` from
`workbench.ts`, the same function every other path builder in core
already calls. Checking in the bridge and in the REST route instead
would be two checks that can drift, and would leave the next caller of
the core function unguarded. The hosts stay thin: they pass what they
were sent and core refuses it.

The error must reach the caller as a refusal, not a crash: the bridge
replies `ok: false` with the message, the REST route answers 400. Both
already wrap the call, so this is a matter of the message being readable.

## Decision: a schedule entry is validated by the reader's own rule

`isScheduledRun` is what `readScheduledRuns` trusts. The route applies it
to `add` before writing, so what is accepted is exactly what will be read
back. `startAt` and `requestedAt` must parse as dates; `path` must be a
`RunPathId`; `changeName` must pass `assertValidChangeName`. A body that
carries both `add` and `remove` is a 400: there is no order in which both
are what the sender meant.

## Decision: one shape rule for every value that reaches argv

`customAgent` is checked against `MODEL_ID_PATTERN` at validation time,
beside the existing `vscode-chat` and capability refusals. The pattern
already encodes the one property that matters here — the value cannot
begin with `-` — and a second pattern for the same property would be a
second thing to keep true. If a real custom agent name ever needs a
character the pattern refuses, the pattern is widened for both, with the
leading-dash rule kept.

The names discovered from a CLI's agent directories are file names, and
a file name beginning with `-` is refused with the same message, so
discovery and validation agree.
