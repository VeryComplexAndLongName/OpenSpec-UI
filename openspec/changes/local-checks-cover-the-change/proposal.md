## Why

The repairs of PRs #924 and #926 exposed local full suites competing for
CPU and real Git processes. The operator required targeted local checks
and full runs only in CI. CLAUDE.md still requests workspace-wide checks,
and openspec/config.yaml still asks for package-wide verification, so a
future agent would repeat the same costly work. Unscoped mechanical check
declarations can also make the local Harness run those commands before
its verifying agent starts.

## What Changes

- Make targeted local verification and CI-only full runs explicit in the
  OpenSpec context, task rules, and apply/archive guidance.
- Require task authors to name selected checks and keep unscoped local
  mechanical declarations out of this repository's new changes.
- Replace the contradictory CLAUDE.md instruction with a pointer to the
  policy and explain the workflow in openspec/README.md.
- Keep the full CI workflow and its required checks in place.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- quality-gates: agents verify their changes locally with scoped checks;
  complete verification runs in CI.

## Impact

Repository instructions and OpenSpec governance only. No application,
command/event protocol, package version, or Harness runtime change.
