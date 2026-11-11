---
title: Two changes can start. One has to wait to verify
summary: Use a start-time blocker or a declared wait before Verify, depending on when a change needs its dependency.
cover: cover.png
cover_alt: The blue OpenSpec Workbench owl pauses with wings open beside an hourglass and the article title.
---

One change defines the next version of an interface. Another adds a consumer. The consumer's proposal and implementation can proceed against an agreed contract. Its verification needs the interface change to be archived where the harness can see it.

OpenSpec Workbench gives the operator two points at which to express this dependency. Which one to use depends on when the consumer needs the other change.

## Wait before the first stage

If work on the consumer cannot start without the interface, put the dependency in the consumer's `.openspec.yaml`.

```yaml
blocked_by:
  - interface-v2
```

The readiness report names the blocker. The harness preflight refuses to start the consumer while `interface-v2` is active. Once the archive is visible, the consumer can start.

```bash
openspec-ui-cli show readiness
```

## Wait just before verification

If only verification needs to wait, use a declared step in the consumer's own `harness.json`. For this scenario use the step below in place of the start-time blocker.

```json
{
  "steps": [
    { "step": "await-change", "before": "verify", "param": "interface-v2" }
  ]
}
```

The consumer can go through its earlier stages. Before Verify, the chain checks for the active `interface-v2` directory in the workspace it reads. Archiving removes that directory, which releases the wait. A dependency already archived in that checkout lets the step complete immediately. While the directory is present, the wait appears in the timeline and has its own timeout. Time spent waiting is excluded from the chain's run-time ceiling.

If you run the two changes in separate worktrees, start with the active dependency visible in the consumer's checkout and bring in the archive and updated spec before verification. A checkout that never contained the active directory can satisfy the wait immediately. Fetching a remote branch alone leaves the checked-out files as they were.

Use [the parallel worktree guide](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/how-to/run-changes-side-by-side.md) to set up the two directories. [ADR 0021](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0021-declared-chain-steps.md) describes how a declared step is inserted when a chain starts or resumes.
