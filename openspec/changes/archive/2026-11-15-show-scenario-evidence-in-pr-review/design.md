## Context

PR Review knows the exact local revision it compares and can refresh GitHub checks for the published PR head.

## Decisions

- Read scenario headings and the optional JSON mapping from the reviewed Git commit. The working tree can hold edits unrelated to the reviewed commit. Reuse the OpenSpec headings parser for the scenario inventory.
- Use the capability, requirement and scenario titles as distinct keys. Resolve names only against observed GitHub checks for the same revision. Inferring links from source or test names would present guesses as verification.
- Include the scenario inventory and the observed results in the shared Markdown summary. The two hosts already display and copy this report. No command, event or transport shape changes.

## Non-Goals

- Enforcing scenario coverage at merge time or recording manual verifications.
- Deriving coverage from test names, code paths, or an agent's unsupported assertion.

## Risks / Trade-offs

A mapping is a declared association. A passing check proves only that the named check passed at the reviewed revision. Duplicate observed names require a more specific check name.
