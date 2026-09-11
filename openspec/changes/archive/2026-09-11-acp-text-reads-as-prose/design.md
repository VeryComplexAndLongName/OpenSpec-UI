# Design

## Decision: the reading rule lives in core, the joining stays in the panel

Whether an `agentUpdate` carries text, and what that text is, is
knowledge about the ACP payload. That belongs beside the protocol, in a
browser-safe leaf module, not in a React component — both hosts render
these events, and the VS Code timeline webview reads the same stream.

`collapseStreamEvents` keeps doing the joining. It already owns "which
consecutive events fold into one", and adding a third case there is the
change; teaching it a fourth concept is not.

## Decision: text chunks concatenate with nothing between them

`stderr` and `progress` join with a newline inserted, because each of
those events is a whole line that arrived separately. An ACP text chunk
is not a line. It is a slice of a sentence, cut wherever the model
happened to flush, and a separator between two slices puts a break
inside a word.

Plain concatenation, exactly as `stdout` does. Getting this wrong
replaces one kind of fragmentation with another that is harder to see.

## Decision: only the same kind joins

A run of `agent_message_chunk` joins into one message. A run of
`agent_thought_chunk` joins into one thought. A message chunk and a
thought chunk never join with each other: they are different things
said by the agent, and running them together would read as one
statement that was never made.

Every other `sessionUpdate` — a tool call, a plan, a usage figure —
joins nothing and breaks the run, which is correct. A tool call between
two sentences happened between them.

## Decision: an update whose shape is unfamiliar is left alone

The payload is passed through verbatim and ACP is not ours. An update
this rule does not recognise as text is rendered as it is today, not
guessed at. Guessing would turn a protocol addition into silently
mangled output, and the existing behaviour is at worst unchanged.

## Non-Goals

Changing the adapters, the event protocol, or how a non-text update is
displayed. Making the transcript prettier in any way other than not
cutting it into pieces.

## Risks / Trade-offs

Joining hides the chunk boundaries, so a reader can no longer tell how
the text arrived. That is the point, and nothing downstream reads the
boundaries — the audit log records the run, not the stream.

If an agent emits text and a tool call alternately, the transcript
gains a break per tool call. That is the honest shape of what happened,
and it is what the raw CLIs already show.
