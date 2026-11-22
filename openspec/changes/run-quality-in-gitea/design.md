# Design

## Goals

Establish real required Gitea results before moving publication authority.

## Non-Goals

Registry writes, deployment, disabling GitHub, accepting external fork code
on the shared host, or duplicating the Publication Center queue.

## Decisions

Use the existing internal hppmcp-pr Docker runners for trusted authors only.
Separate labels are not host isolation; externally supplied code needs a
separate ephemeral VM. Do not give these quality jobs production secrets.

Retain TypeScript/lint/unit/build/package-smoke, independent production audit,
OpenSpec merge validation, native VS Code integration/VSIX packaging, browser
and accessibility checks, the version-PR package path and dependency review.
GitHub's dependency-review action requires its API, so instead compare the
lockfile's changed nodes against npm's full advisory report. Keep this review
independent of the quality job. Advisory service failures remain explicit
unknown warnings, matching the existing audit policy, not fabricated findings.

Use Gitea-compatible artifact uploads. Bound commands with timeout rather than
depending on ignored job timeout settings. An aggregate check examines each
expected job result for the actual event and version/non-version branch.
Reject a green result consisting only of skipped prerequisites.

During bootstrap, main is checked too; there are no release side effects.
Release receipt/optimization belongs to the parent migration. Reject a smaller
lint-only CI because it would leave the billing-blocked integration unchecked.

## Risks / Trade-offs

Shared runner capacity may lengthen jobs. Untrusted code must stay off this
host. A first actual full run can expose existing Linux-only defects; fix or
track those with evidence, never mark an unexecuted suite as passed.

## Validation

Locally run only scripts/gitea-ci.test.mjs and
scripts/review-dependency-diff.test.mjs, changed JavaScript ESLint, YAML parsing
and strict OpenSpec validation. Full suites and real host/browser tests run in
Gitea. Record exact run links in evidence.md before delivery is called complete.
