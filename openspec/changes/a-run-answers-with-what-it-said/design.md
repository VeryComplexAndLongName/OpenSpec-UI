## Context

Two hosts build a `HarnessChainRunner` and wrap their events in
`withAgentStatus`: `packages/extension/src/extension.ts` and
`packages/cli/src/run-change.ts`. Only the first was given
`chainMessageHandlers` and `chainAnswerWriter`.

`runStage` set `said` from a `completed` event's `summary`. For the chain's
last stage that field carries the agent's closing words; for a middle stage
it is absent, and the chain yields no `completed` at all until the end.

## Decisions

### The answer carries the tail of what was streamed

`stdout` chunks and ACP streamed text are remembered as the stage runs,
capped at 2000 characters, and the last of them is the answer when the
stage has no closing summary. The cap is on the tail rather than the head:
what answers a question is what the agent finished by saying.

**Rejected: asking the agent for an answer.** A question the operator asked
is already in the stage's prompt, and the stage answered it. A second call
would spend a second time to re-say what was said.

**Rejected: the whole stage output.** A stage can print thousands of lines,
and the channel is a file per message.

### Both hosts wire the channel, from one place each

The two calls stay as they are - `chainMessageHandlers` beside
`chainStopRequestHandlers`, `chainAnswerWriter` on the chain's deps - so a
third host adds them the same way. What this change fixes is that the
terminal host had neither.

## Risks / Trade-offs

- **A tail can end mid-sentence.** Better than a sentence that says
  nothing; the answer names the stage and the run, so the full output is
  one look away.
- **A noisy stage makes a noisy answer.** The cap bounds it, and a stage
  whose last 2000 characters are tool output is a stage whose answer is
  worth little either way - the question reaches the agent, and the agent
  chooses what to end with.
