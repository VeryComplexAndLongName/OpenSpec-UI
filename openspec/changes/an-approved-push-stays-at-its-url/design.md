## Goals

Keep the prepared HTTP transport at the approved endpoint even where Git has a URL-specific redirect policy.

## Non-Goals

Change the transport for a push outside the approval path.

## Decisions

Add a command-scoped exact URL setting alongside the generic setting. Ask Git to resolve the setting for that same URL before dispatch. A generic flag alone loses to a matching `http.<url>.followRedirects` entry. Following a redirect would send a request to a destination the operator has never seen.

## Risks / Trade-offs

A moved HTTP repository needs its current URL in the remote config before an approved push can reach it.
