## Goals

Include OpenSpec quality jobs in the shared hppiigit budget without changing quality gates or published artifacts.

## Non-Goals

No release, package version, production credential, application, or protocol changes.

## Decisions

Use --cgroup-parent=user.slice in the existing root Docker executor. The host configures CPUQuota=300%, MemoryHigh=11G and MemoryMax=13G. Native rootless PR engines retain the standard user-UID.slice hierarchy under the same parent. An arbitrary parent for user managers was rejected after runc 1.3.6 lost D-Bus OwnerUID detection during the live infrastructure probe. Independent per-job caps alone were rejected because they do not bound aggregate competition. See ADR 0061 and DocsAI ADR 0037.

## Risks / Trade-offs

The shared ceiling includes small operator login sessions and can slow jobs when the pool is busy. The aggregate memory ceiling may reject concurrent peak requests; it protects Gitea rather than reserving every job's maximum. This does not change the isolation boundary: quality jobs still receive no host Docker socket or production secrets.

## Validation

Locally run scripts/gitea-ci.mjs, scripts/gitea-ci.test.mjs and OpenSpec strict validation using pinned Node/npm. Full quality runs in Gitea only. Verify actual job cgroup placement and aggregate limits after idle deployment.
