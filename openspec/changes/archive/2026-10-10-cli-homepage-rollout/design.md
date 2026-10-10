# Design

## Decisions

Separate pre-merge CI/contract verification from post-merge production evidence.
The owner explicitly approved this correction to the lifecycle on 2026-10-10.
Rejected: checking rollout tasks before deployment, bypassing merge gates, or
removing verification without a named successor that owns it.

## Non-Goals

Application changes, new registry publishing, secret changes and CI overrides.

## Risks / Trade-offs

A deploy or manifest notification may fail after code has landed. Record the
actual failure here, retain the last good snapshot, and do not mark complete
until the public site proves both deployment and current metadata.
