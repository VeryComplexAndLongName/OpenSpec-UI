## Context

The core report is already consumed by both hosts. Users can practice the same final review and copy operation with a built-in fixture.

## Decisions

- Use a static sample review in Core and reuse the report and clipboard surfaces. A generated repository would require Git setup and leave state on disk.
- Mark the data as fictional and omit network-dependent actions in the example.

## Non-Goals

- Creating or cloning a demo repository, installing an agent, or running a workflow.

## Risks / Trade-offs

The example demonstrates the review experience but does not cover the full lifecycle of a live change.
