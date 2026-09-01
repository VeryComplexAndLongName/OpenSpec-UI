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
