# 0007: CI CLI as a Third Thin Delivery Target

Status: Accepted

Date: 2026-08-17

## Context

ADR-0001 establishes exactly two delivery targets on top of shared core:
standalone (server + browser UI) and the VS Code extension. Both are
interactive — a human drives a UI and watches a live event stream.
Continuous integration has a different, narrower need: a non-interactive
merge gate that runs `openspec validate --strict` across every active
change in a repository and fails the build when any change is invalid,
with output a CI system can parse or display in logs. Neither existing
delivery target fits this: the server delivery target requires standing
up an HTTP server and a browser session for a single yes/no check; the
extension requires VS Code itself. Both are the wrong shape for a CI
runner, which just needs a process that exits 0 or non-zero.

This repository's own CI (`.github/workflows/quality.yml`) already
demonstrates the exact use case: today it would have to shell out to the
external `openspec` CLI directly, per change, with no aggregation and no
JSON summary — exactly the gap a thin core-consuming CLI closes.

## Decision

1. **Add `packages/cli` as a third thin adapter over `@openspec-ui/core`,
   following the same shape as `server`/`extension`.** It imports core
   directly (no HTTP, no webview — closer to the extension's "direct
   import" mode than to the server's REST layer) and contains no business
   logic of its own; `listChanges`/`validateChange` from
   `packages/core/src/openspec.ts` remain the single source of truth.
2. **Scope the CLI to one command: `validate`.** It lists every active
   change, runs strict validation on each, and prints an aggregated JSON
   report (`{ ok, results: [...] }`); a human-readable `--format text`
   table is available for local/manual use. This is the concrete,
   approved use case ("validate --strict as a merge gate with JSON
   output") — not a general-purpose reimplementation of every `openspec`
   subcommand, which core's existing `openspec.ts` wrapper and the two
   interactive delivery targets already expose where a human is present.
3. **Exit codes are part of the contract.** `0` = every change is valid;
   `1` = at least one change failed strict validation (an actionable CI
   failure); `2` = the CLI itself could not complete the check (bad
   arguments, `openspec` CLI missing, filesystem error) — distinct from
   `1` so a CI system can tell "your change is broken" apart from "the
   tooling itself is broken," which call for different responses.
4. **Ships unbundled, run via `tsx` like `server`'s `cli.ts`.** No new
   packaging/publishing pipeline is introduced; the CLI is consumed the
   same way `server`'s dev entry point already is (`npm run start
   --workspace <pkg> -- <args>`), from within a checkout that has this
   monorepo's dependencies installed. Turning it into a globally
   installable, published binary is a separate decision for if/when an
   external consumer actually needs that.
5. **This repository's own CI wires it in for real, as the first
   consumer.** `.github/workflows/quality.yml` gains a step that runs
   `validate` against this repository's own `openspec/changes/`,
   demonstrating the merge-gate use case rather than leaving it as an
   unused capability.

## Rejected Alternatives

### Add a `--ci` flag to the existing server's `cli.ts`

Rejected: conflates two different lifecycles (a long-running HTTP server
vs. a run-once check-and-exit process) in one entry point, and would
still require standing up a server/port for a single validation pass —
exactly the overhead a CI merge gate should not carry.

### Have CI shell out to the external `openspec` CLI directly, per change

Rejected: this is what the gap actually is today (see Context) — no
aggregation across changes, no single JSON summary a CI system or a
future dashboard could consume, and every consumer of this pattern (this
repo's own CI included) would have to reimplement the same list-then-
validate-then-aggregate loop instead of sharing it through core.

### Make the CLI a general-purpose wrapper for every `openspec` subcommand

Rejected: no approved use case beyond the validate merge gate exists yet;
building out `plan`/`implement`/`status`/etc. as CLI commands duplicates
capability the two interactive delivery targets already provide (through
a human-in-the-loop UI, which a CI runner is not) and adds surface area
with no consumer.

## Consequences

- `packages/core`'s `listChanges`/`validateChange` gain a third caller,
  reinforcing that they are the actual source of truth for this behavior
  rather than something `server`/`extension` re-derive.
- CI feedback on OpenSpec change validity becomes a single aggregated
  step instead of implicit/manual (a human running `openspec validate
  --strict` locally, as happened ad hoc earlier in this repository's
  history).
- A fourth adapter naturally follows this same shape if another
  non-interactive consumer appears (e.g. a git pre-push hook); this ADR
  is the precedent for "thin, core-consuming, no new business logic."
