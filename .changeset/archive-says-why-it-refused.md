---
"@openspec-ui/core": patch
---

Report why an archive was refused. `openspec archive` refuses precisely — naming
the requirement whose modified block drifted, and the scenario that would have
been dropped — and with `--json` it says so as structured data. That reached a
caller as the entire JSON document, sentence buried inside, because the wrapper
turns a non-zero exit into an error string.

`archiveChange` now reads the refusal's `status[]` entries and throws with their
messages, including the report's own `fix` line, so a caller sees "…current spec
contains scenario(s) not present in the modified block: 'The same reader returns
the next day'. Refresh the change spec before archiving… No files were changed."
Every error is reported rather than the first, since a change can be refused for
more than one reason at once.

It keeps throwing rather than returning the report, unlike `validateChange`:
every caller here asks whether the archive worked and why not, not for a result
to render.
