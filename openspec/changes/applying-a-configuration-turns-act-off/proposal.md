## Why

Reported by the owner on 2026-10-05: in a workspace whose changes run
under `supervisor.mode: "act"`, applying any named configuration to a
change failed with "supervisor.mode "act" needs autonomyLevel
"autonomous" in the same file". Every named configuration sets
`autonomyLevel: "semi-autonomous"`, and applying one keeps the rest of the
change's file, `supervisor` included; the file it produced broke a rule
the product itself states, so the write was refused. The same happened in
a change's Harness Settings when the autonomy level was moved away from
Autonomous while Act was chosen: the view only warned that saving would
be refused.

The owner's rule: configurations change freely, by rules a person can
follow, and are refused only where refusing is truly needed.

## What Changes

- Where a person's own edit takes a change's autonomy level below
  Autonomous - a named configuration applied, or the level changed in the
  change's Harness Settings - an Act the change had is turned off rather
  than refused: the supervisor's mode is removed, so the change follows
  the workspace's (Advise unless the workspace says Off). The fallback
  agents and the two allowances are kept, so choosing Act again under
  Autonomous restores what was set.
- Every surface that does this says so where it says what was applied or
  saved.
- A file written by hand that sets Act without Autonomous is refused
  where it would act - a run - and where it is written, but it opens in
  its Harness Settings, which put it right on saving: nothing chose
  between the two, and only a person's save does.

## Capabilities

### Modified Capabilities

- `agentic-harness`: applying a named configuration turns off an Act it
  leaves without Autonomous.
- `shared-ui`: a change's Harness Settings turn Act off, and say so, when
  the autonomy level leaves Autonomous.

## Impact

- `packages/core`: `harness-templates.ts` (the rule as one function, and
  `changeTemplateConfigToWrite` applying it).
- `packages/webui`: `harness-settings-parts.tsx` (`changeConfigToSave`, the
  applied message), `ChangeHarnessSettingsView.tsx` (the note).
- `packages/extension`: `commands.ts` (the applied note).
- `HARNESS.md`.
