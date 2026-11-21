# 0057: The npm package launches the existing Workbench host

Status: Accepted

Date: 2026-11-21

Amends ADR 0020 decision 2 only for a launcher of the existing interactive delivery. Preserves ADR 0001's shared Core/two interactive hosts and ADR 0009's bundled public CLI distribution.

## Context

The standalone browser product cannot be tried from its published npm channel without cloning and building the monorepo. The owner approved a one-command launcher. Reimplementing UI-dependent operations as terminal commands would violate ADR 0020; launching the already existing browser host does not require doing so.

## Decision

1. `open workbench` launches the existing standalone server and shared UI. All other CLI commands remain thin Core callers and do not start a server. The launcher supplies no new agent autonomy, approval bypass or external-workspace flag.
2. Bundle private server/Core code into the CLI and include the prebuilt browser entry, chunks, index and build version metadata under its published dist directory. Declare real external Node dependencies in the CLI manifest. Do not publish private workspace packages to make installation work.
3. Bind only to 127.0.0.1, reuse the ephemeral server token and Origin/cwd policy, print the launch URL and keep the process attached to the terminal. Do not install or start agents, install OpenSpec, open a browser automatically, or create a background daemon. Existing configured Workbench workflows keep their own permissions and behavior.
4. Reuse server startup composition for audit, runners, per-worktree roots and process ledger. Supply actual package versions captured from their own manifests during the build instead of resolving the CLI manifest as if it were Core/server after bundling.
5. Treat the production tarball as the delivery boundary: test an isolated install with dev dependencies omitted, no private workspace modules, live HTTP/WS authentication, static chunks and correct metadata. Keep this in existing quality and version-PR checks.

## Rejected alternatives

- A new published server package adds a second npm product and coupled release obligations without a new host.
- Downloading/building repository sources at launch retains the original friction and makes runtime depend on build tools and the current branch.
- Exposing UI decisions through new headless CLI handlers would reopen ADR 0020's consent and picker restrictions. The launcher exposes the existing UI instead.
- Binding all interfaces or detaching a daemon by default broadens access and obscures lifecycle. Neither is needed for a local Workbench.

## Consequences

The CLI tarball and install grow to include the existing interactive delivery, but all existing command names and permissions remain intact. Users need a supported Node runtime; operations that use git, OpenSpec or agents still require those executables. Build metadata must be regenerated with each package version. A terminal can close the UI host while persisted run history remains governed by existing Core behavior.
