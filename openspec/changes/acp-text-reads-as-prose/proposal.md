# ACP text reads as prose

## Why

Reported on 2026-09-10, translated because every file here is English:
"When an agent runs over ACP, the text it gives back is shown in
pieces. Sometimes half a sentence, sometimes half a word. Can the text
simply be appended to what has already arrived?"

The obvious reading is that no buffering exists. It does.
`collapseStreamEvents` in `packages/webui/src/components/AiPanel.tsx`
joins consecutive `stdout` chunks into one, and has since the panel was
written — which is why a raw-CLI agent's output reads as continuous
prose.

ACP agents do not emit `stdout`. They emit `agentUpdate`, carrying the
`session/update` payload verbatim (`protocol.ts:342`), and a streamed
reply arrives as a run of `agent_message_chunk` updates whose `content`
is a slice of text. `collapseStreamEvents` has no case for them, so
every slice renders as its own element. The reader sees exactly what
was reported: half sentences, sometimes half words.

The gap is not a missing buffer. It is a buffer that knows two event
kinds and not the third.

## Capabilities

### Modified

- Text streamed by an ACP agent is joined as it arrives, and reads as
  the prose it was written as.

### New

- What counts as a text chunk in an ACP update, and how two of them
  join, is answered in one place both hosts read.

## Out of scope

Rendering anything else an ACP update carries. A tool call, a plan, a
usage figure and a permission request are not prose and are not joined;
they stay separate, and a tool call arriving between two sentences
remains a real boundary in the transcript.

Changing what the adapters emit. The payload is passed through verbatim
on purpose — rendering it is the surface's concern, and this change
stays on that side of the line.
