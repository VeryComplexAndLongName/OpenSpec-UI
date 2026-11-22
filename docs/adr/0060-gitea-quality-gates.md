# 0060: Complete quality gates in Gitea

Status: Accepted

Date: 2026-11-22

## Context

GitHub billing prevents jobs from starting. Gitea has usable internal Docker
runners, but the old workflow lacks several required suites. Product behavior
remains shared through Core as ADR 0001 requires.

## Decision

Port the complete quality inventory before publication cutover. Use explicit
aggregate result checks, independent lockfile advisory review and bounded
commands. Keep quality without production credentials. Existing GitHub jobs
remain until a later verified migration step disables them.

The internal runners share a Docker daemon and accept trusted internal authors
only. Public fork submissions must not automatically run here; an isolated
ephemeral VM is required first. Runner labels alone are not isolation.

## Rejected Alternatives

Lint-only Gitea checks lose integration coverage. Skipping billing-blocked
checks does not verify code. GitHub dependency-review API calls retain the
old service dependency; changed-node advisory review is portable instead.
Publishing from quality conflates check execution and external writes.

## Consequences

Actual Gitea run evidence is required. Main receives a full bootstrap check
without release effects. Registry/deployment work remains separately tracked.
