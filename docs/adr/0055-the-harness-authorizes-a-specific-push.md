# 0055: The Harness Authorizes a Specific Push

Status: Accepted

Date: 2026-11-09

## Context

ADR 0042 handles questions an agent raises. A runtime policy has to hold
even when an agent asks nothing. ADR 0014 already gives the Harness a
controlled boundary for remote Git actions and a per-change allowlist.

## Decision

A change can opt into operator approval for the push in its Harness
`git` stage. The runtime checks the allowlist before opening the request.
The approval is consumed once, for the source commit and destination
repository and ref shown to the operator. The runtime rechecks policy
and the action before execution. It refuses a changed or unbound
destination and asks again on a new attempt. Questions about the change
remain part of its decision record under ADR 0042.

Reuse the existing permission event and resolution command with typed
details for the push. Core owns the pending request and does not restore
grants from a previous process. Hosts display the request and deliver the
choice. A terminal without an interactive prompt cannot approve.

## Consequences

The gate works independently of the agent and the autonomy level, for the
push the Harness executes. A per-change opt-in limits rollout and makes
the extra stop predictable. An external agent's subprocesses remain
within that adapter's own permission and sandbox boundary.

## Alternatives Considered

- Put the request in the stage prompt. A missing marker would still let the chain advance.
- Accept free-text decisions as permission. An answer such as `gitflow` cannot identify the exact remote write.
- Gate every Git action in the first change. Each action needs its own enforceable target and stale-approval rules. The Harness push gives us one operation we can bind to a commit and a ref.
