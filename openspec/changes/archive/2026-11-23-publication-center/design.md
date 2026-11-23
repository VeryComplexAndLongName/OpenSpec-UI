## Context

The user explicitly requests automatic publication controlled by Homepage. npm already trusts publish.yml in the npm environment. Marketplace now supports GitHub OIDC with vsce 4.0.2. See ADR 0058.

## Decisions

Quality produces version-tagged immutable release assets, including a CLI tarball, and publishes publications.json beside releases.json. A contract entry names channel, stable version, release URL, SHA-256 and source commit. The manifest is updated atomically without rewriting branch history.

Publish keeps its filename and the npm and marketplace environments. It runs only on main after successful Quality or a bounded recovery schedule. A short worker requests a Homepage-audience GitHub identity, claims one leased job, downloads and hashes its approved artifact, verifies the remote version before any write, then uses the channel's native OIDC publication. It reports completion to Homepage, which independently confirms the platform result. No permanent GitHub write token is needed on the server.

The worker never rebuilds packages, accepts arbitrary URLs, handles PR artifacts, or silently falls back to a PAT. A lost response is reconciled on the next finite queue attempt. A registry mismatch or exhausted retry remains visible. The successful main workflow follows required PR checks rather than repeating the suite.

Rejected alternatives: publishing npm from the server cannot use npm's supported GitHub-hosted OIDC path; dispatching Actions from Homepage requires a permanent write token; keeping typed per-version confirmation violates the owner's automatic-publication requirement.

## Non-Goals

Do not alter delivered product behavior, agent protocols, editorial holds, package versions or registry credentials unrelated to this transition. Do not rebuild old released versions or claim that a synthetic test proves a real registry write.

## Risks / Trade-offs

Marketplace needs a separately configured trust policy. A registry outage can exhaust three attempts and requires an explicit operator retry after repair. Recovery schedules add a bounded delay. A lost LinkedIn response remains uncertain because its API cannot safely support a blind retry. The contract retains the latest one hundred release entries while the durable database retains discovered history.

## Rollout

Deploy Homepage first, verify its OIDC rejection and queue smoke, configure Marketplace trust for this workflow and environment, then merge the worker and artifact producer. Verify real OIDC identities and remote confirmations. Existing immutable releases are reused at cutover; published npm versions are reconciled before writes. Archive both changes after actual deployment.

## Validation

Targeted Node contract/worker and workflow-policy tests locally; full Quality and review in CI. Homepage tests signed JWTs, claim concurrency, lease expiry, finite retries and article duplicate safeguards. Live deployment checks verify the timer, worker identity and confirmed registry outcomes.
