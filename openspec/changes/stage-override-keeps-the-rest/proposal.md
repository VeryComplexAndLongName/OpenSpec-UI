# A stage override keeps what it does not name

## Why

`agent-harness.json` is the base and a change's `harness.json` is laid
over it. That is true for the configuration as a whole and false for a
single stage: `mergeHarnessConfig` merges `stepAgents` key by key, and
then replaces each stage's entry outright.

So a change that means to say "run `apply` at maximum effort" and writes
`{ agent: "claude-cli-acp", effort: "max" }` loses the model the base
file set for that stage. `--model` is never passed and the CLI falls back
to its own default, silently.

This is live in this repository right now. The base file sets
`claude-opus-5` for three stages and `claude-sonnet-5` for `apply`; the
"Balanced" named configuration writes stage entries with no model at all,
so applying it discards every one of them.

Found while designing the run dialog, by reading the merge rather than
by any check.

## Capabilities

### Modified

- A stage entry in a change's configuration overrides the fields it
  names and inherits the rest from the base.

## Out of scope

The whole-object override of `budget`, `timeout`, `reviewGate` and
`checkpoints`. Those were argued deliberately — `timeout`'s comment
explains why a key-by-key merge there would produce a pair nobody wrote —
and nothing here changes them.
