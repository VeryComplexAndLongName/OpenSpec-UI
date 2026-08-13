## Context

The server already defaults to `127.0.0.1`, but its API has no caller
authentication or Origin checks. REST handlers consume `cwd` directly, and
the WebSocket server accepts every upgrade on its path.

## Goals

- Authenticate every API request and WebSocket connection.
- Apply one workspace policy to command and direct OpenSpec endpoints.
- Preserve intentional external-cwd mode.
- Avoid persisting credentials.

## Decisions

- Generate a cryptographically random token unless the embedding host supplies
  one, and expose only an authenticated launch URL to the UI.
- Carry the token in `X-OpenSpec-UI-Token` for REST and in a WebSocket
  subprotocol for WS. Read the initial browser token from `location.hash`.
- Accept Origin only when its host matches the listening server address.
- Add a request context containing the authorized workspace policy and pass it
  to all REST handlers.
- Reject oversized HTTP bodies with 413 and configure the WebSocket server's
  maximum payload.

## Risks

- Existing scripts that call endpoints directly will receive 401 until they
  provide the token.
- Optional server embedding must use the same authenticated URL contract.
