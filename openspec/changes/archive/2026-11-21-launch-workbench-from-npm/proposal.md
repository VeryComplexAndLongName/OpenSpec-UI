# Proposal

## Why

Standalone currently requires a source checkout, dependency install and browser build, while ADR 0009 already provides an npm distribution channel for the CLI. Amend ADR 0020's terminal-only boundary through ADR 0057 so the same public package can launch the existing interactive host without duplicating its behavior or relaxing its protections.

## What Changes

- Add `npx @openspec-ui/cli open workbench --cwd <project>` with a configurable local port, a tokenized launch URL and graceful terminal shutdown.
- Ship the existing standalone server and prebuilt shared UI inside the CLI tarball; keep private workspace packages bundled and real runtime dependencies declared.
- Reuse one server startup factory for audit, per-worktree runners and process ledger configuration. Keep all execution/business policy in Core.
- Preserve actual Core/server build versions in the embedded delivery and make listen errors/shutdown observable rather than hanging on browser sockets.
- Verify an isolated production-only install of the packed package in CI, with no monorepo resolution fallback.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ci-cli`: launch the existing Workbench delivery from the public npm package.
- `standalone-app`: embedded version provenance and bounded host lifecycle.

## Impact

CLI routing/build/distribution, a shared standalone startup factory, explicit embedded version metadata, targeted lifecycle tests and a tarball smoke step in the existing quality/version gates. No agent command/event or REST authorization changes. Existing CLI commands keep their lifecycle and exit contracts.

## Changelog

Affected deliveries: public CLI and standalone server; Core vocabulary receives an internal patch.

- CLI: Launch the standalone Workbench with `npx @openspec-ui/cli open workbench --cwd <project>` without cloning or building OpenSpec-UI. The command prints an authenticated localhost URL, accepts `--port` and stops on Ctrl+C; OpenSpec and agent executables remain separate prerequisites for the operations that use them.
- Server: Embedded Workbench hosts can report the Core/server versions included in their build. Listen failures reject cleanly, and closing the host disconnects browser sockets so shutdown can finish.
