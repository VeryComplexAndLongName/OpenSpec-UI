## Why

`the-operator-can-say-something-to-a-run` shipped with one item open: the
agent end of its live check, which needs a real chain run. That run
happened on 2026-09-20, against a throwaway workspace, and found two
defects the tests could not.

**The terminal host never took a message.** The channel was wired into the
editor and not into `packages/cli`. A run started with `openspec-ui-cli
run` kept a status record, read requests to stop, and ignored every note
and question addressed to it. Nothing failed: the messages simply sat in
the directory, and a person would have concluded the feature did not work.

**An answer said nothing.** The first live answer read

> the verify stage ended completed without a closing summary

while the agent had, in that same stage, answered the question in full and
acted on the note. A middle stage's `completed` event carries no summary -
only the chain's last stage does - so the answer fell back to its "said
nothing" wording while the words were right there in what the stage
streamed.

## What Changes

- `packages/cli/src/run-change.ts` takes messages and writes answers, with
  the same two calls the extension uses. A run from the terminal is spoken
  to exactly as one started from the editor is.
- A stage's answer carries what the agent actually said: its closing
  summary where it has one, and otherwise the tail of what it streamed,
  capped at `ANSWER_WORDS_LIMIT`. The "said nothing" wording stays for a
  stage that truly said nothing.

## Capabilities

### Modified Capabilities

- `execution-core`: what an answer carries.
- `ci-cli`: a run from the terminal takes what the operator said.

## Impact

- `packages/core/src/harness-chain-runner.ts` and its test.
- `packages/cli/src/run-change.ts` and its test.
- A changeset for `@openspec-ui/core` and `@openspec-ui/cli`.

## Explicitly out of scope

- The standalone server's own runs. It does not build a chain runner of
  its own; when it does, it takes the same two calls.
- Summarising a stage for the answer. The tail is what the agent said, not
  a summary of it: summarising would mean a second model call to answer a
  question the stage already answered.
