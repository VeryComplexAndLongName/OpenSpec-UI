# Design

## Context

See proposal.md. `Forge` already selects credentials from the origin; `createChangeInItsWorktree` owns branch creation/sharing. OpenSpec's goal metadata alone does not enter `prepareAgentContext`.

## Goals

Preserve source identity and operator consent through preview, confirmation, worktree creation and Propose context in both hosts.

## Non-Goals

Issue search, comments, attachments, cross-repository import, automatic agent execution, invented acceptance criteria, issue write-back and new command/event kinds.

## Decisions

1. Add optional `Forge.readIssue(number)` implemented by existing configured API/gh adapters. Parse numbers or exact same-repository issue URLs before reading; no request follows the supplied URL or links in issue text. Reject PR-shaped responses. Canonical links are constructed from the configured repository. Reject arbitrary URL fetch instead of attempting redirect allowlists.
2. Core returns a preview with bounded plain-text title/body, state, update time, truncation and a revision digest of the complete fetched source. Confirmation re-reads and compares the digest before any worktree/change operation. Refuse mismatches rather than silently importing a newer request. Snapshot limits are 512 title characters and 32768 body characters, visibly marked; the entire source is capped at 256 KiB before accepting it.
3. Compose the existing creation callback to write `source-issue.json` before its initial commit/push. Store no token, comments or attachments. The snapshot is input, never a completed planning artifact. No overwrite of an existing source. Native modal confirmation and the standalone preview disclose worktree creation and possible branch push.
4. `prepareAgentContext` reads only this designated bounded, regular non-symlink source within the real change directory, formats it as JSON reference data, and keeps the normal allowlist/cwd/audit rules. The trusted plan-stage instruction remains unchanged. Reject merely placing goal in metadata because the agent would miss the source. Both hosts create only; Run Change remains separate.

## Risks / Trade-offs

- Issue edits after confirmation can happen: the saved snapshot identifies what was confirmed and is not a live sync.
- Truncated requests can omit details: visible truncation, original link and explicit source status prevent claiming completeness.
- External text may contain hostile instructions: render plain text, quote as reference data, never derive commands/paths from it, retain the existing security model.
- The existing create/share operation can partially succeed: preserve its normal refusal reporting and leave any created worktree for recovery.

## Protocol

No agent command/event changes. Additive REST preview and optional issue fields on create preserve existing adapters. Native VS Code uses direct Core imports, no local server.

## Migration Plan

Optional source file needs no migration; existing changes and create requests work unchanged. Rollback removes the new actions and leaves source snapshots as inert repository data.

## Validation

Targeted readers, revision/refusal/creation/prompt tests, REST contract, standalone component, native command and a real read-only forge/HTTP smoke. Full verification is pending in the existing PR CI gates.
