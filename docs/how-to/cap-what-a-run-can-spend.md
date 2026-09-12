# Put a ceiling on what a run can spend

**Edit** `openspec/agent-harness.json` for every change, or
`openspec/changes/<id>/harness.json` for one — creating whichever you
pick if it is not there. Most changes have no file of their own.

**1.** Set the whole-chain ceilings.

**2.** Set a time ceiling as well — not instead.

```json
{
  "budget": { "maxCostUsd": 10 },
  "timeout": { "maxRunSeconds": 7200, "maxStageSeconds": 1800 }
}
```

Why both: a spending ceiling is checked **between stages**, because a
run's cost is not known while it is running, and six of the ten
supported agents report no usage at all — for those, the money ceiling
has nothing to compare and the time ceiling is the only one with any
force. A time ceiling stops a stage that is already running.

One thing worth knowing before you tighten it: a stage stopped at a
ceiling is retried from the start, so a ceiling set too low makes a run
take **longer**, not shorter.

What actually caps a run, which ceiling acts where, and why there is no
single `budget: <number>`: [`LIMITS.md`](../../LIMITS.md). Accepted
fields and the per-stage ceilings: [`HARNESS.md`](../../HARNESS.md).
