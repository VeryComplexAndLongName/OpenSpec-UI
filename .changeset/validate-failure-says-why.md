---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

Make a failing merge gate say why. `openspec validate --json --strict` exits `1`
to report an invalid change, printing the report on stdout; the wrapper rejected
on any non-zero exit and kept only stderr, so every ordinary invalid change was
reported as one that could not be validated — with the diagnosis that named the
fix discarded, and `failedItems: 0, totalItems: 0` for the change that failed.

`validateChange` now treats a non-zero exit carrying a readable report as the
report. Where no report can be read, the reported reason prefers whichever
stream carries a diagnosis and says "no diagnosis reported" rather than passing
off a runtime warning banner as an explanation. The CLI's per-change result
gains an `issues` field carrying what the underlying CLI stated. The exit-code
contract is unchanged: `1` for a validation failure, `2` only where the check
itself could not run.
