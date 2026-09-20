---
"@openspec-ui/core": patch
"@openspec-ui/cli": patch
---

A run started from the terminal takes the notes and questions addressed to
it, and writes the answers it owes: the channel was wired into the editor
only. An answer now carries what the agent actually said - the stage's
closing summary where it has one, and otherwise the tail of what it
streamed - instead of reporting that a stage with no summary said nothing.
