## Context

The existing archive pipeline applies deltas using the OpenSpec CLI and reports exact refusals. Preview needs an independent baseline and must leave the user repository alone.

## Decisions

- Run the archive operation in a disposable directory built from the locally known default branch specs and the selected commit's standard change artifacts. Use the real archive CLI so the displayed patch reflects how OpenSpec applies the delta. A hand-built patch could disagree with the installed CLI.
- Find requirement-level changes by comparing the default branch to the reviewed change's merge base. Read other local change branches from Git and compare named requirements. Relying on the existing capability-level warning would overstate collisions.
- Keep the work in Core and route it through the existing read-only change action and Markdown report.

## Non-Goals

- Writing an actual archive, fetching, resolving conflicts, or bypassing the real archive's task gate.
- Transferring workspace configuration or previewing custom artifact layouts and remote-only branches.

## Risks / Trade-offs

The result is a snapshot from local commits and the installed OpenSpec version. A newer target or an uncommitted delta can change the outcome.
