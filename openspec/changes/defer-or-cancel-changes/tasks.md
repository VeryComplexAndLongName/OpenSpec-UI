## Implementation

- [x] Record the decision, reason, and history beside the change through a guarded write.
- [x] Separate dispositions from active Pipeline cards, including changes in their own worktrees.
- [x] Offer the same control in the standalone and VS Code hosts.
- [x] Refuse to archive or start a Workbench chain for a held change.
- [x] Document how to record, share and restore a decision.

## Verification

- [x] Verify stale writes, history, chain preflight, and preservation of specs.
- [x] Check that the landed archive pass skips held changes.
- [x] Verify the real browser defer and restore flow.
- [x] Validate defer-or-cancel-changes in strict OpenSpec mode.

The 30 focused core tests and two real-Git archive cases passed. Chromium deferred the change from its card, read the reason and restored it. Type checks, scoped lint, changeset checking and strict OpenSpec validation passed.
