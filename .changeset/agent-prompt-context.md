---
"@openspec-ui/core": minor
---

Fix `prepareAgentContext` sending an effectively empty prompt to every
`plan`/`review`/`implement` run (single-stage or as part of a `"chain"`)
for every agent, since the product first shipped: it now actually reads
and embeds the change's real `proposal.md`/`design.md`/`tasks.md` and any
delta-spec content under the run's `changeDir`, instead of relying on a
`promptContext` field that no caller has ever populated. Also adds an
explicit instruction to work only within the named change directory, as
additional insurance against an agent wandering to a different
`openspec/changes/<id>/` directory than the one it was asked about — found
live when a `copilot-cli` `implement` run picked a different change to
work on than the one actually selected.

See `openspec/changes/agent-prompt-context/` for the full diagnosis and
fix. No change to the allowlist/cwd-sandbox/audit security boundary —
`prepareAgentContext` still cannot affect what gets run or where.
