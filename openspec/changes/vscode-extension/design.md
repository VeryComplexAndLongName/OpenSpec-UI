## Context

See proposal.md and `docs/adr/0001-*.md`, especially "Rejected
Alternatives" (the extension runtime-mode decision was revised after external
architecture review).

## Goals / Non-Goals

**Goals:**
- Primary path (direct import + message bridge) works with no network server,
  removing lifecycle risks (ports/collisions/cleanup) from default use.
- Maximize native VS Code API usage as defined in ADR.

**Non-Goals:**
- Chat Participant API is not required for first version.
- No multi-window state synchronization for the same repo in first version.

## Decisions

- **Direct `core` import + message bridge is primary mode; local server is an
  optional settings flag.** Default is serverless.
- **TreeDataProvider for Changes/Archive/Specs; Webview only for AI panel and
  custom interactive views not covered by tree UI.**
- **Diff always uses `vscode.diff`, never a custom `shared-ui` component.**
- **Optional local server reuses the same `server` package as standalone** with
  dynamic free-port selection and proper lifecycle cleanup.

## Risks / Trade-offs

- [Risk] Optional local-server mode still requires port selection and
  multi-window collision handling when enabled.
  Mitigation: keep this complexity off the default path.
- [Risk] Two modes (message bridge vs local server) require testing both.
  Mitigation: shared-ui contract tests run equivalent transport scenarios;
  extension-specific mode-toggle tests are added.
- [Risk] Webview CSP blocks arbitrary network by default, so localhost mode
  needs explicit configuration.
  Accepted as implementation detail, not architecture blocker.