# Run a change from a terminal

**1.** Run it.

```bash
openspec-ui-cli run my-change
```

**2.** Read the exit code. `0` the chain completed, `1` the change did
not — a stage failed, a declared check failed, or the run was cancelled
— and `2` the CLI declined to start or could not: bad arguments, a
missing `openspec` CLI, a change whose configuration this terminal
cannot honour, another host holding the workspace.

The `1` and `2` are deliberately distinct, so a script can tell "your
change is broken" from "the tooling is broken".

The refusal you are most likely to meet first is exit `2` with: this
change's configuration pauses between stages for a confirmation, and
there is no terminal here to put that choice to. That is not a flag to
override — it is the change asking for somebody, and the answer is
[run a change unattended](run-a-change-unattended.md) if that is what
you meant.

Every command, its options and the whole exit-code contract:
`openspec-ui-cli --help`.
