All runs used the real `openspec` CLI already installed in this
environment (not mocked), via `npm run start --workspace @openspec-ui/cli
-- validate ...`.

## All-valid path (real repo state)

`validate --cwd C:/Prog/OpenSpec-UI` against this repository's own
`openspec/changes/` (7 active changes at the time, including this one)
returned `ok: true` with all 7 entries `valid: true`, and the process
exited `0`. `--format text` produced the equivalent human-readable table
ending in "All changes valid."

## Failure path (real, not simulated)

Created a genuine scratch change (`openspec new change
"smoke-test-invalid-scratch"`, left deliberately incomplete — no
proposal/design/tasks content) and re-ran `validate`. The real `openspec`
CLI exited non-zero for that specific change while every other change
still validated normally; the aggregated report captured it as `{ valid:
false, error: "...exited with code 1: ..." }`, still listed all 7 other
changes as `OK`, printed "One or more changes failed validation.", and
the process exited `1` — the exact "one broken change doesn't abort the
run" behavior design.md describes. Removed the scratch change afterward
(`rm -rf openspec/changes/smoke-test-invalid-scratch`); confirmed via
`git status` that no trace was left.

## Vacuous-empty-repo nuance (observed, not a bug)

Running `validate` against a directory with no `openspec/` at all
(`--cwd` pointed at an empty temp directory) returned `ok: true` with
`results: []`, exit code `0` — confirmed this is genuine upstream
`openspec list --json` behavior (`root.source: "implicit"`, empty
`changes[]`), not something this package introduces. Worth knowing: a
badly mistyped `--cwd` pointing at the wrong directory reports a vacuous
pass rather than an error. This wasn't in the original design's error
scenarios and is a pre-existing characteristic of the wrapped `openspec`
CLI itself (out of scope for this change to alter — see
`packages/core/src/openspec.ts`, which this package only calls, not
reimplements).

## Not exercised live

Exit code `2`'s other trigger — the `openspec` binary missing from `PATH`
entirely — was verified only via the mocked `openspec-validate.test.ts`/
`main.test.ts` unit tests (`listChanges()` rejecting), not a real PATH
manipulation in this environment, since doing so live would have
disrupted other tooling still in use this session.
