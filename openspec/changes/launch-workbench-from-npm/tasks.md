## Implementation

- [x] In docs/adr/0057-the-npm-package-launches-the-workbench.md record the explicit launcher exception to ADR 0020 while preserving Core/host/security boundaries.
- [x] In docs/adr/README.md link ADR 0057 without rewriting unrelated decisions.
- [x] In packages/server/src/create-workbench-server.ts extract the existing audit/runners/per-worktree/ledger composition as createWorkbenchServer.
- [x] In packages/server/src/cli.ts delegate startup to createWorkbenchServer and preserve existing dev arguments.
- [x] In packages/server/src/index.ts export the startup factory for the bundled launcher.
- [x] In packages/server/src/server.ts accept optional embedded build versions, reject listen errors and disconnect browser sockets before close.
- [x] In packages/cli/src/open-workbench.ts implement bounded startup validation, explicit packaged assets/metadata, ready output and stop cleanup without new permissions.
- [x] In packages/cli/src/main.ts parse --port and route only valid open-workbench arguments to the launcher; preserve existing handlers.
- [x] In packages/cli/src/subcommands.ts register only the open workbench pair.
- [x] In packages/core/src/action-vocabulary.ts add the Workbench noun for the existing Open verb.
- [x] In packages/core/src/message-register.ts register the tokenized launcher-ready guidance under CLI-022.
- [x] In packages/core/src/message-register.test.ts retain CLI-022 in GIVEN and verify the generated message page.
- [x] In docs/messages.md regenerate the registered launcher guidance and pass its equality test.
- [x] In packages/cli/scripts/build.mjs package the existing client/index/build metadata and bundled server while retaining published runtime dependencies as external.
- [x] In packages/cli/package.json declare ws runtime/server dev-only dependencies and the isolated package smoke script, without manual version edits.
- [x] In package-lock.json record the manifest dependency changes with pinned npm 10.9.0 and inspect the exact diff.
- [x] In packages/cli/scripts/smoke-package.mjs verify an isolated production tarball install, static chunks, API/WS authorization, actual build versions and stopped process without workspace fallbacks.
- [x] In .github/workflows/quality.yml run the package smoke after existing quality/version builds, preserving required gates.
- [x] In docs/how-to/launch-workbench.md document a complete npm launch, port, stop and prerequisite example without claiming automatic agent installation.
- [x] In README.md make the npm launcher discoverable in standalone setup.
- [x] In .changeset/launch-workbench-from-npm.md provide authored CLI minor/server patch notes matching the actual behavior, with no hand-edited versions.
- [x] In .changeset/embedded-workbench-lifecycle.md provide the separate authored server patch note for embedded versions and lifecycle fixes.

## Scoped verification

- [x] In packages/cli/src/open-workbench.test.ts verify valid startup, invalid cwd/port, ready JSON, occupied-port refusal and orderly close; run only this named file.
- [x] In packages/cli/src/main.test.ts verify the named open-workbench routing/argument cases and no invocation on invalid input; run only those names.
- [x] In packages/server/src/workbench-lifecycle.test.ts verify real version authorization, listen rejection and open-client shutdown; run only this named file.
- [x] In packages/server/src/server.test.ts run only the existing returns-core-and-server-package-versions case to verify the default unbundled caller contract.
- [x] Run packages/cli/src/subcommands.test.ts to verify preserved vocabulary and routing; record the actual result.
- [x] In packages/server/e2e/standalone.spec.ts add the named standalone/embed footer regression and pass its e2e typecheck; execution belongs to the existing CI browser gate, not a full local browser run.
- [x] In a real browser inspect the bundled CLI launch URL with the standalone footer and VS Code embed without it; record actual rendered versions and visible behavior before claiming the local UI smoke passed.
- [x] Run affected CLI/server/Core typechecks and changed-path ESLint; record exact commands instead of full local suites.
- [x] Build the CLI and execute only its production package smoke through pinned npm; record actual tarball, source versions, HTTP/chunk and WS results before claiming clone-free launch.
- [x] Review all delta scenarios and actual transport/security junctions, strictly validate OpenSpec and validate the exact authored Changeset notes.

## Completion evidence

Full verification is pending in the existing PR CI gates. Use standard filtered post-merge archival with recorded evidence. Remove only this change's clean owned worktree after archived remote main is verified. Public npm availability follows the normal version and trusted-publishing workflow, after implementation checks; do not claim the registry command exists before publication.

## Recorded local evidence

Node 24.21.0 and npm 10.9.0. Own npm ci completed. Pinned `npm install --package-lock-only --ignore-scripts` changed exactly two dependency entries: ws runtime and private server dev-only. No full suite ran locally.

- CLI: from packages/cli, selected open-workbench.test.ts and main.test.ts names passed 13 tests, with 25 unrelated filtered out. subcommands.test.ts passed 6 cases. The launcher tests cover exact asset/version forwarding, JSON ready output, stop cleanup, invalid port/cwd/metadata, listen refusal and no extra permissions. Routing tests preserve existing commands/help behavior.
- Server: workbench-lifecycle.test.ts passed all 3 real HTTP/WS cases in 0.14s. The initial occupied-port test exposed ws forwarding HTTP errors before the HTTP promise handler; startup now handles both channels temporarily and removes both listeners after the outcome. The original default versions case in server.test.ts passed separately, 110 unrelated tests filtered out.
- Core action-vocabulary.test.ts and message-register.test.ts passed 12 tests, including CLI-022 and generated-page equality. Scoped analyzeTestFile checks confirmed explicit test/hook budgets on both new filesystem/network test files.
- Static checks passed for affected CLI, Core, server and server e2e TypeScript projects. Scoped ESLint passed on the changed sources/tests/build/smoke scripts, including the final footer regression. Strict OpenSpec validation, git diff --check and exact authored CLI/server Changeset validation passed.
- CLI build completed with the shared browser entry/chunks/index and versions.json. `node <pinned npm-cli.js> run smoke:package --workspace @openspec-ui/cli` passed against a production-only isolated install of openspec-ui-cli-0.33.0.tgz. Neither private Core nor private server could resolve from that install. Shell/app and both JS chunks loaded, unauthenticated REST/WS were refused, a foreign Origin and an external cwd were refused, and metadata matched actual source Core 0.150.1/server 1.66.0. Existing --help exited without a host. Its measured cold start was 11066ms; an initial 10s help deadline was too short, so both startup paths use an explicit 30s budget. Windows child termination and socket closure passed. Real graceful SIGTERM exit 0 is asserted in the same smoke on POSIX CI; local orderly close is separately covered by launcher/lifecycle tests.
- Browser smoke: the built CLI served an owned empty temporary directory on 127.0.0.1:55005. Edge rendered the real shell and footer `core 0.150.1 / server 1.66.0 / webui 1.94.4`. The vscode-local-server embed retained the Pipeline tab and had zero version-footer nodes. No initialization or agent run was requested. The expected read-only missing-root diagnostic in that empty fixture does not indicate launcher failure. The owned server process was stopped and its empty fixture removed. Initial browser-tool tab creation timed out but recovery bound the already-created tab and verified both modes.
- The new named CI browser regression shows included package versions only in the standalone footer. Its source/e2e typecheck passed; execution remains pending in the existing full CI browser gate, not claimed as a local browser-suite run.
- Review matched all added/modified scenarios to real lifecycle tests, launcher/routing cases, production artifact smoke and the footer regression. Token/Origin/cwd checks and Core permissions are reused unchanged. Private packages are bundled, ws is declared, metadata comes from the correct manifests, and static chunks use explicit packaged paths. Existing CLI handlers remain independent; no new agent command/event or cancellation policy was introduced. Active agent work is stopped through existing controls before host shutdown. Public npm availability remains pending the normal version/publish workflow.
