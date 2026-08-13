# Change: Harden the Local Transport

## Why

Loopback binding does not authenticate browser callers. The REST and
WebSocket adapters need a shared security boundary that prevents cross-origin
requests, rejects untrusted working directories, and bounds untrusted input.

## What Changes

- Require an ephemeral per-server token for REST and WebSocket API access.
- Reject browser requests from origins other than the active server origin.
- Authorize every client-provided working directory against server policy.
- Bound HTTP and WebSocket payload sizes.
- Pass the token to the standalone browser through a URL fragment.

## Impact

- Affected spec: `standalone-app`
- Affected packages: `server`, `webui`, `extension`
- Architecture: ADR 0005
- Compatibility: direct API callers must provide the server token
