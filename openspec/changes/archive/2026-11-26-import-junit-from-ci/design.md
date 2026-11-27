## Context

Existing JUnit imports normalize testcase identities and outcomes and retain one
report with a user-declared revision. Both forges expose authenticated metadata
for identifying runs or jobs, but a workflow can test a different checkout.

## Non-Goals

This change does not trigger CI, discover arbitrary archive layouts, or claim
semantic coverage.

## Decisions

- Use a numeric run or job ID in the configured origin. Free-form artifact URLs
  were rejected because they cannot establish the source and could lead to a
  request outside the selected repository.
- Read `junit.xml` and `tested-commit.txt`, with the latter written by CI from
  the checkout used for testing. A run SHA alone was rejected because it does
  not prove what checkout the workflow tested. Require the metadata and
  producer claims to agree.
- Add optional provenance to the normalized snapshot. Replacing the snapshot
  format was rejected because existing local imports must still work.
- Add an optional explicit PR Review request with the displayed head and ID.
  Existing execution commands and events keep their contracts.

## Risks / Trade-offs

The evidence relies on the configured repository's CI producer. Bounded reads,
redirect rules, exact archive entries, and the existing JUnit parser protect
the local import. A report for an older known commit remains historical.

## Verification

Gitea Quality run 8626 passed on implementation head 85dfb918e0815c683c47f2c1d5a2ddf51b8814cb. Reviewed artifact and revision provenance, repository and artifact selection, redirect restrictions, bounds and preservation of reports on rejected imports. Gitea run 8626 artifact 18630 validated 17 testcases on 85dfb918e0815c683c47f2c1d5a2ddf51b8814cb. The GitLab path passed a Workbench browser test with a local API fixture. The standalone package smoke exercised installation of the built CLI tarball.
