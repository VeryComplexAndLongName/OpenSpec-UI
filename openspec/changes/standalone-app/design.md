## Context

See proposal.md. `server` is the only package in this repository expected to
accept network connections by default (in contrast to extension primary mode,
which avoids network ports).

## Goals / Non-Goals

**Goals:**
- Keep `server` thin and auditable — all logic remains in `execution-core`,
  this layer only serializes protocol traffic.
- Bind localhost only by default.

**Non-Goals:**
- No multi-user auth/session model (this is a local single-user tool, not a
  SaaS backend).
- No built-in git commit/branch/merge UI.

## Decisions

- **Default bind: `127.0.0.1`, not `0.0.0.0`**.
  The server orchestrates CLI agents with local filesystem access; exposing
  beyond localhost without explicit user intent is not acceptable.
- **WebSocket/event stream for long-running commands, REST for one-shot paths
  such as `status`**.
- **Port is configurable with a reasonable default, no auto-discovery in
  standalone mode** (explicit user launch path).

## Risks / Trade-offs

- [Risk] No authentication on localhost means any local process can call the
  server while it is running.
  Mitigation: localhost bind limits scope to local machine. Optional token
  hardening can be added later if needed.