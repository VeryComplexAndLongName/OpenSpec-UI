## Context

PR Review already resolves a change's branch and its one open same-repository PR, and reads local audit evidence. The forge abstraction selects GitHub CLI or direct GitHub API credentials.

## Decisions

- Fetch check runs and commit statuses by the published head SHA, and read both active rulesets and classic branch protection from the PR base. Show separate source results and preserve any reported check application identity. The existing aggregate gate loses individual status and link information. Inferring expected checks from workflow YAML would miss organization rules and external checks.
- Fetch only when the operator selects Refresh GitHub checks. Refresh the whole review so the local comparison and published PR snapshot are resolved together. Partial or denied reads are explicit. Matching by check name alone cannot establish that an expected app reported a check.
- Use the existing PR Review response and opt-in input, with Core formatting and host-specific presentation. The agent command and event protocol is unchanged.

## Non-Goals

- Starting or rerunning workflows, changing repository rules, and deciding merge eligibility.
- Checking GitLab, Gitea, GitHub Enterprise Server, or the synthetic test merge commit in this MVP.

## Risks / Trade-offs

GitHub can limit permissions or return more rows than the bounded read collects. The report qualifies absent results when expected checks or observed checks could only be read partially. A head reading is useful evidence about that revision and may differ from GitHub's PR merge decision.
