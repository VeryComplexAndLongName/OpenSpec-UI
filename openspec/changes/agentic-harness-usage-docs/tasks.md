## 1. Runbook section

- [x] 1.1 Add "Agentic Harness — how to work with it" section to
  `openspec/README.md`: config file locations, the three ways to edit them,
  what each `autonomyLevel` does today, and `reviewGate.mode`'s current
  (no-op) status pending the deferred git action. Updated a second time
  during this same change, after `agentic-harness-autonomy`/
  `agentic-harness-run-menu` actually shipped: the section originally
  written described `semi-autonomous`/`autonomous` as inert and "Run with
  Agentic Harness" as forward-referenced-but-not-yet-built; both are now
  real, so the section documents the actual chain behavior (checkpoint
  pausing, the `autonomous` per-change-only restriction, the hard stop
  before `git`) and the real entry point instead.
- [x] 1.2 Cross-reference `docs/adr/0011-...md`, `docs/adr/0012-...md`, and
  `openspec/specs/agentic-harness/spec.md` rather than duplicating their
  content (per `CLAUDE.md`'s "pointers, not duplicates").

## 2. Verification

- [x] 2.1 `npm run lint:english` passes (no new non-English text) — passes.
- [x] 2.2 Every path/command referenced in the section actually exists:
  `openspec/agent-harness.json` (path pattern), the three VS Code commands
  (`openspec-ui.configureHarness`, `openspec-ui.configureHarnessForChange`,
  `openspec-ui.runWithHarness` — all in `packages/extension/package.json`),
  `docs/adr/0012-...md`, and both change directories.
- [x] 2.3 `openspec change validate --strict agentic-harness-usage-docs` —
  passes.
