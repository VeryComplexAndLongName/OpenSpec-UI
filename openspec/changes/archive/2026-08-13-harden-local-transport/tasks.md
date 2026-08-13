## 1. Security Boundary

- [x] 1.1 Add ephemeral server token authentication for REST and WebSocket.
- [x] 1.2 Enforce same-server Origin for browser API requests.
- [x] 1.3 Centralize workspace authorization for all requested working directories.
- [x] 1.4 Bound REST and WebSocket payload sizes.

## 2. Clients

- [x] 2.1 Pass the token through the standalone URL fragment and FetchTransport.
- [x] 2.2 Keep extension optional-server mode functional with authenticated URLs.

## 3. Verification

- [x] 3.1 Test missing/invalid token and hostile Origin rejection.
- [x] 3.2 Test default external-cwd rejection and explicit opt-in.
- [x] 3.3 Test oversized REST and WebSocket payload rejection.
- [x] 3.4 Run workspace typecheck, lint, tests, builds, and live smoke checks.
