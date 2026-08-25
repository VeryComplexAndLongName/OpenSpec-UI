import type { CatalogTemplate } from "../template-catalog.js";

// New category ("observability") — deliberately narrow: structured JSON
// request logging only, not a full observability stack (metrics, traces,
// log shipping/aggregation — see design.md's Non-Goals). Node.js/
// TypeScript-specific rather than language-agnostic, matching this
// catalog's existing pattern of ecosystem-specific tooling templates
// (`node-vitest-testing-baseline`, `production-dockerfile`) over vaguer
// cross-language ones where the concrete library choice actually matters.

export const structuredRequestLogging: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "structured-request-logging",
    title: "Add structured JSON request logging to a Node.js/TypeScript HTTP API",
    category: "observability",
    version: "1.0.0",
    summary:
      "Replaces ad-hoc console.log/console.error calls with a structured JSON logger and one request-logging middleware emitting method/path/status/duration for every request.",
    variables: [
      {
        name: "loggerModulePath",
        prompt: "Module path for the shared logger instance (e.g. src/logger.ts)",
        default: "src/logger.ts",
      },
      {
        name: "logLevelEnvVar",
        prompt: "Environment variable name controlling log verbosity",
        default: "LOG_LEVEL",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — unstructured console output
that is hard to grep/aggregate, or a specific incident where request-level
detail (which request, how long it took) was missing from the logs. -->

## What Changes

- Add a shared logger instance at \`{{loggerModulePath}}\`, configured to
  emit structured JSON and to read its level from \`{{logLevelEnvVar}}\`.
- Add one request-logging middleware/hook that logs a single structured
  entry per request: method, path, status code, and duration in
  milliseconds.
- Replace existing ad-hoc \`console.log\`/\`console.error\` calls in the
  request-handling path with calls through \`{{loggerModulePath}}\`, so
  every log line carries the same structured shape.

## Capabilities

### New Capabilities

- \`request-logging\`: <fill in what this actually covers in your project
  — e.g. "every request produces one structured log line with status and
  duration">

## Impact

- New: \`{{loggerModulePath}}\`, request-logging middleware/hook.
- Modified: every call site that previously used \`console.log\`/
  \`console.error\` in the request-handling path; server startup wiring
  (registering the middleware).
- Dependencies: a structured-logging library (e.g. \`pino\`).
`,
    design: `## Context

<!-- Fill in: current logging state (plain console output? a different
partial logging setup?), and whether logs are shipped anywhere downstream
(a log aggregator, stdout capture in a container platform) that structured
output needs to stay compatible with. -->

## Goals / Non-Goals

**Goals:**
- Every request produces exactly one structured log line with a
  consistent field shape (method, path, status, duration), machine-
  parseable without a custom regex.
- Log verbosity is controlled by \`{{logLevelEnvVar}}\` at runtime, not a
  hardcoded level requiring a code change to adjust.

**Non-Goals:**
- Not adding distributed tracing (trace/span IDs across service
  boundaries) — this template covers single-service structured logging
  only.
- Not adding log shipping/aggregation (e.g. to a log-management service)
  — this template only changes what gets written to stdout/stderr, not
  where it goes afterward.
- Not migrating every existing log call in the codebase in one pass — the
  request-handling path is in scope; other call sites migrate
  incrementally afterward.

## Decisions

### Logging library: <fill in — e.g. pino, chosen for low overhead and native JSON output>

<!-- Rejected alternatives and why. -->

### One log line per request, emitted after the response is sent

Logging after the response completes (rather than at request start)
means the duration and final status code are known and included in a
single line, instead of splitting one request's information across two
log entries that need to be correlated afterward.

## Risks / Trade-offs

- **[Risk]** Logging request/response bodies by default could leak
  sensitive data (credentials, tokens, PII) into logs. → **Mitigation**:
  this template's request-logging middleware logs only method/path/
  status/duration by default — do not add body logging without an
  explicit redaction strategy.
`,
    tasks: `## 1. Logger setup

- [ ] 1.1 Add \`{{loggerModulePath}}\` exporting a shared logger instance
  configured for structured JSON output, reading its level from
  \`{{logLevelEnvVar}}\`.

## 2. Request-logging middleware

- [ ] 2.1 Add a middleware/hook that, after each response is sent, logs
  one structured entry via \`{{loggerModulePath}}\` with method, path,
  status code, and duration in milliseconds.
- [ ] 2.2 Register the middleware at server startup so it applies to
  every route.

## 3. Migrate existing call sites

- [ ] 3.1 Replace \`console.log\`/\`console.error\` calls in the request-
  handling path with calls through \`{{loggerModulePath}}\`.

## 4. Verification

- [ ] 4.1 Add a test confirming a request produces exactly one log entry
  containing the expected method, path, and status fields.
- [ ] 4.2 Manually confirm \`{{logLevelEnvVar}}\` actually changes what
  gets logged (e.g. setting it to a level that suppresses info-level
  entries).
`,
  },
};
