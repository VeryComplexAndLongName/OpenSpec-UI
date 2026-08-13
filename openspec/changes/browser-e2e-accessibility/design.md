## Context

The standalone delivery is assembled from server static assets, an esbuild
browser bundle, authenticated REST requests, and React state. Existing tests
cover these pieces independently but do not prove that they work together in a
browser.

## Decisions

- Use Playwright Test with its managed Chromium runtime.
- Start `createServer` inside the test on an ephemeral port and pass its
  generated access token through the same URL fragment used in production.
- Use a temporary OpenSpec workspace and the real REST/core path for the user journey.
- Run axe against the stable, loaded workbench state and fail for serious or
  critical violations. Lower-impact findings remain visible in reports without
  making the gate brittle.
- Run browser tests in a dedicated CI job after `quality`, with the repository's
  pinned OpenSpec CLI installed.
- Keep browser artifacts only on failure.

## Trade-offs

- Chromium installation adds CI time and network usage.
- One focused journey gives less breadth than a large E2E suite but keeps the
  gate deterministic and inexpensive enough for every pull request.

## Architecture

This is a test and delivery-quality change. It does not alter the two-target
architecture or runtime ownership rules, so no ADR is required.