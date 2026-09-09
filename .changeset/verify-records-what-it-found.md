---
"@openspec-ui/core": minor
---

`verify` now records what a change's declared mechanical checks found —
how many ran and how many failed, as fields on an audit entry rather than
buried in a sentence. It is recorded whether or not the verifying agent
then runs: a `verify` whose checks failed never invokes the agent, so
before this the run that found the most left no trace at all.

A change declaring no checks records nothing, since an entry saying none
ran reads the same as one saying none failed.
