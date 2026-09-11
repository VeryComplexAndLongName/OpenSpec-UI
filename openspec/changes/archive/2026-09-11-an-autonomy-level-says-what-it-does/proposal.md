# An autonomy level says what it does

## Why

Reported on 2026-09-11: the autonomy level offers three values and says
two of them are not implemented, so they need implementing.

They are implemented. `HarnessChainRunner` treats each of the three
distinctly and each has its own test suite: `assisted` refuses a chain
and says to start stages individually
(`harness-chain-runner.ts:566`), `semi-autonomous` runs the chain and
confirms between stages (`:858`), `autonomous` runs it without
confirmations, is reachable only from a change's own `harness.json`,
and fails a run whose agent asks a permission it cannot answer
(`:574`, `:1106`). An `autonomous` chain was run live on 2026-09-11
against a scratch workspace.

What is wrong is the label. `HarnessSettingsView.tsx:71-72` renders
`semi-autonomous (not yet implemented)` and
`autonomous (not yet implemented)`. `HARNESS.md:282` already calls this
"stale UI copy" and points the reader elsewhere — documenting the wart
instead of removing it, so the guide and the product disagree in
writing.

A worse defect sits beside it. Both the global and the per-change
sections render the same list, so the **global** section offers
`autonomous` — a value `writeGlobalHarnessConfig` refuses outright with
`autonomyLevel "autonomous" is only valid in a per-change harness.json`.
The control offers a choice the save rejects.

## Capabilities

### Modified

- Each autonomy level is named by what it does, not by whether someone
  once thought it unfinished.
- A level that cannot be set where a control stands is not offered
  there.

## Out of scope

The behaviour of any level. All three work; only what the surface says
about them changes.
