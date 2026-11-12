# An Approved Push Stays at Its URL

## Why

[ADR 0055](../../../docs/adr/0055-the-harness-authorizes-a-specific-push.md) binds a push approval to one repository. A URL-specific Git setting can override a generic redirect setting and let the transport contact a different URL.

## What Changes

- Disable redirects for the exact approved HTTP or HTTPS endpoint. Refuse the operation if Git cannot confirm that redirects are disabled.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agentic-harness` — the HTTP transport honors the repository named in the approval.

## Impact

The approved push helper in Core applies this policy for the editor, standalone app and terminal.

## Changelog

Affected deliveries: `openspec-ui-vscode`, `@openspec-ui/server`, and `@openspec-ui/cli`.

- An approved Harness push over HTTP or HTTPS stops when the repository redirects to another URL.
