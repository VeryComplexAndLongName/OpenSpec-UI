# Design

## Context

See proposal.md and ADR 0057. The public CLI currently bundles private Core and leaves published Node dependencies external. Server already accepts explicit static paths for the extension's embedded host. Its runtime relative package.json reads must not accidentally identify the CLI version when bundled.

## Non-Goals

No new agent workflow, cancellation policy or protocol, automatic browser launch, daemon, remote bind, automatic OpenSpec/agent installation, bundled git executable, privilege bypass, or second public npm package. No changes to the extension's primary direct-import mode. Active agent runs are finished/stopped using existing controls before the host is closed.

## Decisions

- Route `open workbench` through a dedicated launcher. Accept only cwd, port and text/JSON output, with port 0 for OS selection and default 4317. Validate the directory and port before listening. Print a single ready object in JSON mode; normal mode prints the private launch URL and stop guidance. Startup failures use the existing registered CLI error path and exit 2; an orderly stop exits 0.
- Extract existing standalone startup composition into `createWorkbenchServer`, used by the dev entry and launcher. It delegates to existing Core runners/audit/ledger and the same server. No agent is started by the launcher itself; existing user-configured Workbench operations retain their semantics.
- Add optional trusted embedded version metadata to ServerOptions. Preserve lazy package-manifest reads for existing callers; the launcher passes metadata read from a build-generated versions.json. Keep token/Origin/cwd checks unchanged. Reject listen errors through the promise and terminate local browser sockets on close.
- Build the shared client with existing build options into CLI dist/workbench and copy index.html. Record Core/server versions from their own manifests there. Bundle the server entry into the CLI, leave ws external and declare it as a runtime dependency; server stays a dev-only workspace dependency.
- Add a scoped production tarball smoke script using the npm executable running the script. Pack, install in a fresh temporary directory with dev dependencies omitted, run the installed CLI, fetch index/app/chunks, test authenticated and unauthenticated API/WS, compare actual version metadata and stop it. Remove only that script's own temporary directory after stopping its process. Run it after the build in the existing quality and version-PR jobs.
- Rejected alternatives and their reasons are in ADR 0057; runtime source builds and private package dependencies would defeat a self-contained published delivery.

## Risks / Trade-offs

The tarball becomes larger and needs correct assets/chunks and published runtime dependencies. An isolated install catches monorepo fallback. The launch URL contains a local access token and should not be shared. A busy default port requires --port or --port 0; no automatic external binding is offered. Git/OpenSpec/agents remain external prerequisites for actions, and browser startup should remain usable before configuring them.

## Verification

Use named launcher/routing tests and real server lifecycle/version cases, scoped lint/typechecks for affected projects and the isolated packed-package smoke. Verify existing version-footer behavior with the named existing tests. Record actual results in tasks.md. Full CI and public registry availability remain pending until their respective checks/publication complete; archive only after actual PR gates pass.

Completed local contracts: 13 selected launcher/routing tests, 6 subcommand cases, 3 real HTTP/WS lifecycle cases and the original default-version API case passed. The production-only isolated tarball served the real client and both chunks, refused unauthenticated REST/WS, foreign Origin and external cwd, and returned actual Core/server build versions. In Edge, the bundled CLI shell displayed Core 0.150.1/server 1.66.0/webui 1.94.4; the embedded mode showed no footer. Existing footer tests were not present, so a named CI browser regression was added and typechecked; its execution is pending in full CI. Exact commands, the initial test-method corrections and Windows/POSIX stop distinction are recorded in tasks.md. No webui/server request payload changed; the artifact smoke exercised the actual existing HTTP/WS boundary. Remaining trade-offs are external executables, larger package, private launch URL, existing agent cancellation policy and pending public npm publication.
