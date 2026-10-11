# Design

## Decision

Move the private monorepo runtime to Node 24.21.0. The root `engines.node`
range starts at 24.2 because that is the minimum on the Node 24 line needed by
the `dsh` CLI used by the core adapter; Volta and CI remain pinned to the
single exact patch release 24.21.0. Keep npm at 10.9.0, which was exercised
successfully under Node 24.21.0 and avoids coupling this runtime change to an
npm major upgrade.

Update the root package-lock engine metadata alongside `package.json`. Set the
same exact Node pin in GitHub quality and publish workflows and in the Gitea
quality workflow. Historical articles and archived OpenSpec evidence keep the
version they were actually tested with.

## Compatibility and Verification

Node 24.21.0 satisfies the lockfile's Node 22.19.0 dependency floor and the
documented `dsh` floor. The Electron-specific archive-removal issue is separate
from the shell runtime: its existing `original-fs` path and dedicated live
extension test remain unchanged. Do not launch that full local integration
harness; the normal CI gate runs it against the updated runtime.

No package API or published behavior changes, so no package changeset is
required.