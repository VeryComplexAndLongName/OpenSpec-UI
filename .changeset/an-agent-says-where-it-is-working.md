---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

Two agents on one machine can see each other. An agent that is not a run
can report itself into the same status directory a run reports into -
`openspec-ui-cli present` - so the Pipeline shows it and another agent can
read it. A resource this machine has one of, such as the browser capture
suite, can be held by a signed claim - `openspec-ui-cli claim
browser-suite` - which says who holds it, waits a bounded time saying so,
expires by heartbeat, and reports rather than proceeding.
