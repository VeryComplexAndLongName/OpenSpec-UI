# A declared blocker blocks

## Why

A change may state, in its own `.openspec.yaml`, that it cannot start
until another one lands:

```yaml
blocked_by:
  - change-graph-in-core
```

`openspec/README.md` says what that means: "`blocked_by` means this
change cannot start until that one lands", and it "resolves the moment
the change it names is archived". `findUnmetBlockers` has computed it
since `change-graph-in-core`, and `openspec-ui-cli ready` reports it.

Nothing stops the run. `resolveChainStart` refuses a chain for an
autonomy level with no chain, for a confirmation nobody can answer, for
a declared step it cannot resolve, and for a stage whose agent this
build does not have — and it does not look at `blocked_by` at all. A
change that says of itself "do not start me yet" starts.

Found on 2026-09-11 while checking an outside review of how this tool
behaves for several people at once. The review's point was that
collision detection is a report rather than a gate, which is true and
deliberate (ADR 0022). This is not that. A collision is an inference
this tool draws; a blocker is a sentence the change's own author wrote,
and it is being ignored.

## Capabilities

### Modified

- A chain refuses to start for a change whose declared blocker is still
  an active change, naming the blocker, before anything is spent.

## Out of scope

Refusing anything on a collision. Two changes that would meet in one
spec file are not ordered, either order works, and two people may
knowingly accept the meeting. That stays a report — see ADR 0022 and
ADR 0024.

A way to start a blocked change anyway. The declaration is a sentence
its author wrote in a file they can edit; the way to start it is to
remove the line or land the blocker. A flag that overrode it would put
the decision in a shell history instead of in the repository, which ADR
0020 rejected for every other gate here.

Failing validation on an unmet blocker. A change that declares one is
perfectly valid to have — it states a plan, and a plan not yet carried
out is not a defect. That is why `checkChangeGraph` deliberately does
not fail on it, and this does not change.
