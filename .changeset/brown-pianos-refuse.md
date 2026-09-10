---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": patch
"openspec-ui-vscode": patch
---

A name arriving from a request is checked before it is used. A change
name now passes the change-name rule before it is joined into a path,
in core beside the path it protects, so a message naming
`../../../../Users/me/.claude` no longer decides where a `harness.json`
is written — the bridge answers `ok: false` and the REST routes answer
400, both carrying the rule the name broke. A schedule entry is
validated on the way in by the same rule the reader applies on the way
out, so a stored row and the response that reported it can no longer
disagree, and a body asking for an addition and a removal at once is
refused rather than half-applied. A `customAgent` obeys the same shape
rule as a model id, for the same reason: both reach the CLI as the value
of a flag, and a value beginning with `-` may be read as a second one. A
custom-agent definition whose file name that rule refuses is reported as
found and not offered, rather than dropped in silence.
