## Decisions

Use codex-cli-acp for migrated assignments. Existing Claude model identifiers belong to the previous assignment, so a Codex assignment uses Codex's configured model. Preserve supported effort values and the existing repository-level autonomy, review and run limits.

Keep both Claude adapters in the registry with their capabilities and explicit selection behavior. The maintainer explicitly confirmed that the requested migration concerns assignments and defaults.

Use the shared DEFAULT_AGENT_ID for command fallback and setup ordering. Prefer an explicitly configured stage over the default when opening setup.

Rejected alternatives
- Replacing adapters would remove a user-selectable capability.
- Sending a Claude model identifier to Codex would build an invalid request.
- Assigning an unrequested Codex model would override the user's existing Codex configuration.

## Non-Goals

Changing model providers inside adapters, changing application features or deploying the application's runtime.

## Risks / Trade-offs

Repository configuration can be overridden by a change's harness.json. Review active overrides and validate the resolved assignments before completion. Run limits retain their configured units.
