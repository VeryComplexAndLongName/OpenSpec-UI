// Single source of truth for the `claude` CLI version this project's
// structured-output translation was verified against — see
// docs/adr/0017-structured-agent-output-parsing.md decision 7. Lives in
// its own neutral module, not inside any one consumer, because it has
// three: `claude-cli-acp`'s structured-output translation, the init
// wizard's version-mismatch check, and usage extraction. No Node imports
// — this constant must stay describable in the browser bundle.
//
// Using this constant (a version comparison, a warning, or any other
// consumer) is each of those three's own work, not this module's — see
// openspec/changes/agent-usage-accounting/tasks.md 4.2.

export const VERIFIED_CLAUDE_CLI_VERSION = "2.1.237";

/** Minimum `claude` CLI version `--max-budget-usd` requires (upstream
 * docs, cited in openspec/changes/harness-step-effort-and-budget/
 * proposal.md) — recorded beside `VERIFIED_CLAUDE_CLI_VERSION` rather
 * than in a second place. Not compared against anything at runtime: a
 * second `--version` spawn just to check this is what ADR 0017 decision
 * 6 rejects; this constant is for a human/consumer comparing against an
 * already-observed version (see agent-usage-accounting). */
export const CLAUDE_MAX_BUDGET_USD_MIN_VERSION = "2.1.217";
