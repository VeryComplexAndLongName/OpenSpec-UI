## Why

The 2026-11-23 hppiigit audit found CI competing with Gitea on four CPUs. ADR 0060 bounds each OpenSpec job, but the host pool now needs an aggregate budget. DocsAI ADR 0037 defines that shared host policy.

## What Changes

- Place OpenSpec job processes in the host's bounded user.slice while retaining the existing CPU/memory limits and socket prohibition.
- Reject runner configurations that omit this parent and document the host prerequisite.

## Capabilities

### New Capabilities
- None: this extends existing quality infrastructure.

### Modified Capabilities
- gitea-quality: shared host resource budget.

## Changelog

No public delivery behavior changes. This only changes the private Gitea executor configuration; an empty Changeset records the infrastructure scope.
