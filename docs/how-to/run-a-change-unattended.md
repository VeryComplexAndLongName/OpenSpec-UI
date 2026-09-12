# Run a change without being asked anything

**Edit** `openspec/changes/<id>/harness.json`. Not the workspace-wide
file: neither key below may be set there.

**1.** Say the chain may run unattended.

**2.** Turn off the pause between stages.

```json
{
  "autonomyLevel": "autonomous",
  "checkpoints": { "requireConfirmationBetweenSteps": false }
}
```

That is the whole change. The run now goes propose → review → apply →
verify → archive without stopping to ask.

Two things it does **not** do:

- It does not push, open a pull request, or merge. That is the `git`
  stage, and it runs only when this change's `reviewGate.mode` is
  `"agent-sufficient"` — a separate decision, deliberately.
- It does not remove the ceilings. A run with nobody watching is the one
  that most wants a budget: see
  [cap what a run can spend](cap-what-a-run-can-spend.md).

Accepted values, what each autonomy level means, and why a global file
may not set either key: [`HARNESS.md`](../../HARNESS.md).
