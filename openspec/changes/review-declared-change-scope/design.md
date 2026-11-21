# Design

## Context

PR Review already resolves the committed head and either the PR-target merge base or the locally marked review commit. Reuse that comparison and the existing summary transport, in accordance with ADR 0001. Directory names, file names and declaration contents are untrusted data.

## Goals

Make unexpected file changes visible in both hosts with a small, explicit mapping format and no additional UI workflow.

## Non-Goals

No automatic permission enforcement, task-to-file inference, glob syntax, agent rerun, editing widget, dirty-tree review, or claim that allowed files satisfy the requirements. No new agent command/event or REST payload.

## Decisions

- Read `openspec/changes/<change>/change-scope.json` from the reviewed commit. Format: `{"paths":["src/auth/","tests/auth.test.ts"]}`. Exact paths match one file; trailing slash matches descendants at a path boundary. Matching uses Git's case-sensitive forward-slash paths on every host. The active change's own planning directory is implicitly included so the declaration can describe implementation paths.
- Bound JSON to 64 KiB and 256 distinct paths of at most 500 characters. Reject absolute paths, drive prefixes, backslashes, control characters, dot/dot-dot segments, globs, duplicates and empty paths. An empty array explicitly permits only the change's planning files. Missing or invalid declarations have an unknown outcome.
- Get scope paths using the same resolved endpoints with `git diff --no-renames --name-only -z`, so moving a file out of or into an allowed directory cannot hide one side. Do not reuse rename-coalesced display names.
- Compare the declaration bytes at the two comparison endpoints. Show a prominent qualification if new or modified. A changed declaration is not independently established agreement; even zero outside paths is described only against the reviewed declaration. Missing comparisons cannot yield an all-clear.
- Limit displayed outside paths to 30 while showing the complete count. Escape each path as inline code. Include every qualification in the existing copied summary.
- Rejected alternatives: deriving paths from free-form tasks is ambiguous; permissive glob matching hides boundary mistakes; blocking agents turns an advisory declaration into an unreviewed security policy; automatically accepting expanded declarations would conceal scope drift.

## Risks / Trade-offs

Declarations are manual and can be broadened in a commit; showing changes to the declaration makes that reviewable but does not authenticate consent. Both new and old paths of a rename may count separately. Directory prefixes can intentionally allow broad areas. The MVP observes committed paths and cannot identify which actor changed them.

## Verification

Target `change-scope.test.ts`, the new named PR Review integration case and unchanged summary presentation contracts. Run scoped ESLint and Core typecheck. A real Core call against a temporary git repository verifies the server/extension boundary output without a new transport field. Full CI remains pending until the PR checks finish; actual evidence is recorded in tasks.md before archival.
