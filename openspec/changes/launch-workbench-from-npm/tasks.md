## Implementation

- [ ] In docs/adr/0057-the-npm-package-launches-the-workbench.md record the explicit launcher exception to ADR 0020 while preserving Core/host/security boundaries.
- [ ] In docs/adr/README.md link ADR 0057 without rewriting unrelated decisions.
- [ ] In packages/server/src/create-workbench-server.ts extract the existing audit/runners/per-worktree/ledger composition as createWorkbenchServer.
- [ ] In packages/server/src/cli.ts delegate startup to createWorkbenchServer and preserve existing dev arguments.
- [ ] In packages/server/src/index.ts export the startup factory for the bundled launcher.
- [ ] In packages/server/src/server.ts accept optional embedded build versions, reject listen errors and disconnect browser sockets before close.
- [ ] In packages/cli/src/open-workbench.ts implement bounded startup validation, explicit packaged assets/metadata, ready output and stop cleanup without new permissions.
- [ ] In packages/cli/src/main.ts parse --port and route only valid open-workbench arguments to the launcher; preserve existing handlers.
- [ ] In packages/cli/src/subcommands.ts register only the open workbench pair.
- [ ] In packages/core/src/action-vocabulary.ts add the Workbench noun for the existing Open verb.
- [ ] In packages/cli/scripts/build.mjs package the existing client/index/build metadata and bundled server while retaining published runtime dependencies as external.
- [ ] In packages/cli/package.json declare ws runtime/server dev-only dependencies and the isolated package smoke script, without manual version edits.
- [ ] In package-lock.json record the manifest dependency changes with pinned npm 10.9.0 and inspect the exact diff.
- [ ] In packages/cli/scripts/smoke-package.mjs verify an isolated production tarball install, static chunks, API/WS authorization, actual build versions and stopped process without workspace fallbacks.
- [ ] In .github/workflows/quality.yml run the package smoke after existing quality/version builds, preserving required gates.
- [ ] In docs/how-to/launch-workbench.md document a complete npm launch, port, stop and prerequisite example without claiming automatic agent installation.
- [ ] In README.md make the npm launcher discoverable in standalone setup.
- [ ] In .changeset/launch-workbench-from-npm.md provide authored CLI minor/server patch notes matching the actual behavior, with no hand-edited versions.

## Scoped verification

- [ ] In packages/cli/src/open-workbench.test.ts verify valid startup, invalid cwd/port, ready JSON, occupied-port refusal and orderly close; run only this named file.
- [ ] In packages/cli/src/main.test.ts verify the named open-workbench routing/argument cases and no invocation on invalid input; run only those names.
- [ ] In packages/server/src/workbench-lifecycle.test.ts verify real version authorization, listen rejection and open-client shutdown; run only this named file.
- [ ] Run packages/cli/src/subcommands.test.ts and the named existing standalone version-footer tests to verify preserved vocabulary/embedding behavior; record exact names and outcomes.
- [ ] Run affected CLI/server/Core typechecks and changed-path ESLint; record exact commands instead of full local suites.
- [ ] Build the CLI and execute only its production package smoke through pinned npm; record actual tarball, source versions, HTTP/chunk and WS results before claiming clone-free launch.
- [ ] Review all delta scenarios and actual transport/security junctions, strictly validate OpenSpec and validate the exact authored Changeset notes.

## Completion evidence

Full verification is pending in the existing PR CI gates. Use standard filtered post-merge archival with recorded evidence. Remove only this change's clean owned worktree after archived remote main is verified. Public npm availability follows the normal version and trusted-publishing workflow, after implementation checks; do not claim the registry command exists before publication.
