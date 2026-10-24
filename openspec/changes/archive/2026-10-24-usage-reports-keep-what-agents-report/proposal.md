## Why

Review after PR #934 found that CLI usage reports discard recorded cache
and thought tokens, turn unknown USD cost into zero, omit Codex ACP's
reported model, and refuse archived changes. A further reproduction found
that a chain's shared runId makes buildUsageReport keep only its first
stage's usage. This also undercounts the budget readback. These defects
violate ADR 0017's per-field degradation and no-estimates decisions.

## What Changes

- Identify agent invocations independently of their chain runId, retaining
  all stage and retry usage, including old logs without invocation ids.
- Aggregate recorded token fields and distinguish unknown cost from a
  reported zero, with coverage for partially reported costs.
- Record the requested model in audit, and preserve Codex ACP's model
  metadata with its current-model attribution limitation.
- Read cost by logical change identity from active or archived changes and
  retained repository logs; disclose model support in show agents text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- execution-core: invocation identity, complete recorded usage, requested
  model audit, and Codex ACP model attribution.
- ci-cli: complete usage reports, archived cost lookup, and model capability
  text.

## Impact

Core, bundled CLI, their focused tests, CLI documentation, and patch
changesets. ADR 0053 defines invocation accounting. No new command or event
kind, no price estimates, no changes to maxTokens' input-plus-output
definition, no change-history redesign, and no full local test run.
