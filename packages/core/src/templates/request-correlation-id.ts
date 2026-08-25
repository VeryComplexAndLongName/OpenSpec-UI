import type { CatalogTemplate } from "../template-catalog.js";

// Language-agnostic on purpose, same convention as
// `flat-to-hexagonal-architecture`: describes the propagation pattern
// itself (generate at ingress, attach to every log line for that request,
// echo back on the response), not a language-specific implementation —
// fill-in markers cover the project's concrete request-context mechanism
// (middleware-local variable, async-local-storage, thread-local, DI-scoped
// service — whichever the project's language/framework provides).
// Deliberately narrow: a single-service correlation id, not distributed
// tracing across service boundaries (see design.md's Non-Goals) —
// complements `structured-request-logging` without requiring it.

export const requestCorrelationId: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "request-correlation-id",
    title: "Add a per-request correlation ID to logs and responses",
    category: "observability",
    version: "1.0.0",
    summary:
      "Generates a correlation ID for every incoming request (or reuses one supplied by the caller), makes it available to every log line produced while handling that request, and echoes it back in the response.",
    variables: [
      {
        name: "correlationIdHeaderName",
        prompt: "HTTP header name carrying the correlation ID (e.g. X-Request-Id)",
        default: "X-Request-Id",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — a specific incident where
correlating log lines for one request (across multiple log statements, or
across services) was not possible, or a support workflow that needs a
customer-reportable request identifier. -->

## What Changes

- Add correlation-id middleware/interceptor that, for every incoming
  request, reads \`{{correlationIdHeaderName}}\` if the caller already
  supplied one, or generates a new one (e.g. a UUID) if not.
- Make the correlation ID available to every log statement produced while
  handling that request, via the project's request-context mechanism
  (fill in the concrete one: middleware-local variable, async-local
  storage, thread-local, or a DI-scoped service).
- Echo the correlation ID back on the response as
  \`{{correlationIdHeaderName}}\`, so the caller can reference it when
  reporting an issue.

## Capabilities

### New Capabilities

- \`request-correlation\`: <fill in what this actually covers in your
  project — e.g. "every log line for a request carries the same
  correlation ID, and the caller receives it in the response">

## Impact

- New: correlation-id middleware/interceptor.
- Modified: the logging call sites in the request-handling path (if a
  request-scoped logger does not already exist, this template adds one),
  server startup wiring (registering the middleware).
- Dependencies: none beyond what the project's language/framework already
  provides for request context and ID generation, unless a UUID library
  is needed (most runtimes have one built in).
`,
    design: `## Context

<!-- Fill in: current state (no correlation mechanism yet, or a partial
one that only covers some routes), and whether downstream/upstream
services already send or expect a correlation header. -->

## Goals / Non-Goals

**Goals:**
- Every log line produced while handling one request carries the same
  correlation ID, without every call site having to pass it explicitly as
  a parameter.
- A caller-supplied \`{{correlationIdHeaderName}}\` is honored (not
  overwritten with a freshly generated one), so correlation IDs can be
  propagated across service boundaries by callers that already set one.

**Non-Goals:**
- Not implementing full distributed tracing (spans, parent/child
  relationships across services) — this template covers a single
  identifier threaded through one service's logs and response only.
- Not validating or rate-limiting caller-supplied correlation IDs beyond
  what is needed to avoid breaking on malformed input (e.g. reject/replace
  one that is empty or absurdly long, do not otherwise interpret it).

## Decisions

### Propagation mechanism: <fill in — e.g. async-local storage, so nested calls don't need the ID threaded through every function signature>

<!-- Rejected alternatives and why — e.g. passing the ID as an explicit
parameter through every function call was rejected because it would touch
every existing call site in the request-handling path. -->

### Caller-supplied IDs are trusted as opaque strings, not re-validated as UUIDs

Rejecting a caller-supplied correlation ID that is not a UUID would break
propagation from callers using a different ID format (e.g. an upstream
load balancer's own request-ID convention); the ID is logged and echoed
back verbatim, never parsed or interpreted.

## Risks / Trade-offs

- **[Risk]** An unbounded caller-supplied \`{{correlationIdHeaderName}}\`
  value could bloat log storage or break header-size limits.
  → **Mitigation**: cap the accepted length and fall back to generating a
  new ID if the supplied value exceeds it, rather than passing it through
  unbounded.
`,
    tasks: `## 1. Correlation-id middleware

- [ ] 1.1 Add middleware/interceptor that reads
  \`{{correlationIdHeaderName}}\` from the incoming request if present
  (within a sane length bound), or generates a new ID if absent or
  invalid.
- [ ] 1.2 Store the ID in the project's request-context mechanism so it is
  available to code handling the rest of that request without being
  passed as an explicit parameter.

## 2. Logging integration

- [ ] 2.1 Update (or add, if none exists) the request-scoped logger so
  every log statement produced while handling the request automatically
  includes the correlation ID.

## 3. Response echo

- [ ] 3.1 Set \`{{correlationIdHeaderName}}\` on the outgoing response to
  the same ID used for that request's logs.

## 4. Verification

- [ ] 4.1 Add a test confirming a request with no
  \`{{correlationIdHeaderName}}\` header receives a generated ID back in
  the response.
- [ ] 4.2 Add a test confirming a request that supplies
  \`{{correlationIdHeaderName}}\` gets the same value echoed back, not a
  freshly generated one.
- [ ] 4.3 Add a test confirming log lines produced while handling one
  request all carry that request's correlation ID.
`,
  },
};
