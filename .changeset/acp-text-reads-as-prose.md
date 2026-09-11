---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
---

Text an agent streams over ACP reads as the prose it was written as. The
event log has folded consecutive `stdout` chunks into one since the panel
was written, which is why a raw-CLI agent's output runs on; an ACP agent
emits `agentUpdate` instead, and the fold had no case for it, so every
slice of a reply rendered as its own element — half a sentence, sometimes
half a word. Consecutive text chunks of the same kind now join with
nothing between them, as `stdout` does and unlike `stderr` and
`progress`, whose separator would land inside a split word. A message
chunk and a thought chunk never join with each other, and anything that
is not streamed text — a tool call, a plan, a usage figure — ends the run
around it, so a tool call that happened between two sentences still shows
between them. Whether an ACP update carries text, and what that text is,
is now answered by one function in `@openspec-ui/core` that both hosts
read; an update whose shape it does not recognise carries no text and is
rendered exactly as before, because guessing at an addition to a protocol
this project does not own would turn it into mangled output.
