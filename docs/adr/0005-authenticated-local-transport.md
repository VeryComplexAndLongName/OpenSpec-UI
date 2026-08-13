# 0005: Authenticated Local Transport

Status: Accepted

Date: 2026-08-13

## Context

The standalone server binds to loopback by default, but loopback alone does
not establish caller identity. A website opened in the user's browser can
attempt requests to localhost, and WebSocket handshakes are not protected by
CORS. Direct OpenSpec endpoints also accept a client-provided working
directory, so every endpoint must enforce the configured workspace policy.

## Decision

1. Each server instance owns an ephemeral random access token. API requests
   and WebSocket handshakes must present that token.
2. Browser requests must have an allowed same-server Origin. Requests without
   Origin remain available to trusted local clients when they provide the
   token.
3. All requested working directories pass through one server-owned workspace
   authorization policy. External directories remain an explicit opt-in.
4. HTTP and WebSocket payload sizes are bounded before parsing.
5. The standalone launch URL carries the token in its fragment so the token is
   not sent in HTTP request targets or referrer headers. The browser transport
   moves it into an API header and WebSocket subprotocol.

## Rejected Alternatives

### Rely only on the loopback bind

Rejected because browser-based attacks can target loopback services and
WebSocket connections are not protected by CORS.

### Store a long-lived token in the repository

Rejected because it creates a secret lifecycle and risks accidental commits.
An ephemeral per-process token is sufficient for a local tool.

### Authorize paths independently in each endpoint

Rejected because endpoint-specific checks drift and new endpoints can omit the
security boundary.

## Consequences

- API clients must know the ephemeral token.
- Optional-server and standalone adapters must expose an authenticated launch
  URL to their own UI.
- External working directories remain possible only through explicit server
  configuration.
