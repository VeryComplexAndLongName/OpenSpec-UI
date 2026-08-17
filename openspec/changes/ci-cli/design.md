## Context

See `docs/adr/0007-ci-cli-third-delivery-target.md` for the
architecture-level decision (third thin adapter, `validate`-only scope,
exit-code contract, unbundled `tsx` distribution). This document covers
the implementation-level decisions the ADR doesn't.

`packages/core/src/openspec.ts`'s `listChanges(options)` and
`validateChange(changeName, options)` already shell out to the real
`openspec` binary via `cross-spawn` (see that file's own comment on why
`cross-spawn`, not `execFile`, for `.cmd`-shim resolution on Windows) and
parse its `--json` output with a runtime type guard, throwing
`OpenSpecCliCompatibilityError` if the shape doesn't match. Neither
function's behavior changes in this proposal — `packages/cli` is a new
caller, not a new implementation.

## Goals / Non-Goals

**Goals:**
- A single command a CI system can run that reports "every active change
  is valid" or "here is exactly what's broken," machine-readably.
- Exit codes that let CI distinguish an actionable validation failure
  from the check itself being unable to run.

**Non-Goals:**
- No `plan`/`implement`/`review`/`status` CLI commands — those require a
  human-in-the-loop agent run or are already served by the two
  interactive delivery targets; see ADR-0007's rejected alternatives.
- No `--change <id>` flag to validate a single change. The approved use
  case is "merge gate for the whole repo" (every active change); a
  single-change mode has no CI consumer yet and would just be unused
  surface area — a human who wants that already has `openspec change
  validate --strict <id>` directly, which `packages/core` already wraps
  for the two interactive hosts.
- No retry/backoff around spawning the `openspec` binary. A CI runner is
  already ephemeral and retried at the job level if needed; adding retry
  logic here would hide a genuinely broken environment instead of
  surfacing it via exit code `2`.
- No publishing/packaging pipeline (npm registry, global install). See
  ADR-0007 decision #4 — this ships and runs the same way `server`'s
  `cli.ts` already does, from within a checkout.

## Decisions

### Per-change validation failure vs. tool-level failure are distinguished, not conflated

`validateChange()` normally *resolves* with a result whose
`summary.totals.failed` says how many items failed — that's an ordinary,
expected outcome (exit code `1` territory, not `2`). But it can also
*reject* (the underlying `openspec` process exits non-zero, or its JSON
output doesn't match the expected shape). A single change's promise
rejecting is captured as that change's own failed result (`{ id, valid:
false, error: message }`) and folded into the aggregate — the run still
produces a full report over every other change, rather than aborting on
the first change that has a problem. Only a failure that prevents
producing *any* report at all — `listChanges()` itself rejecting, or an
unhandled crash — surfaces as the tool-level exit code `2`, since at that
point there is nothing per-change left to report.

Rejected alternative: treat any `validateChange()` rejection as fatal
(abort immediately, exit `2`). Rejected because a CI merge gate should
tell the author about every broken change in one run, not stop at the
first one and require several round-trips to discover the rest — the
same reasoning that motivated aggregation in the first place (see
proposal.md's Why).

### Output shape: `{ ok: boolean, results: ChangeValidationResult[] }`

```ts
interface ChangeValidationResult {
  id: string;
  valid: boolean;
  failedItems: number;
  totalItems: number;
  error?: string; // only set when validateChange() itself rejected
}
```

`ok` is `true` iff every entry has `valid: true`. Kept flat and minimal
— no nested per-issue detail (the individual `OpenSpecValidationIssue[]`
core already returns) in the default JSON, since the CI use case is
"which changes are broken," not full issue text; a human who needs the
detail already has `openspec change validate --strict <id>` (or this
repo's other two delivery targets) for that. `--format text` mode prints
the same data as a table for local/manual use, not a different data set.

### `--cwd` defaults to `process.cwd()`, matching `server`'s `cli.ts`

No new default-resolution logic; same convention already established
(`packages/server/src/cli.ts`: `process.argv[2] ?? process.cwd()`).

## Risks / Trade-offs

- **[Risk]** CI environments must have the real `openspec` CLI on `PATH`
  (this repo's own CI already installs `@fission-ai/openspec` globally in
  two of three existing jobs, but not the `quality` job that runs
  `npm run verify`). → **Mitigation**: the new CI step is added to a job
  that already installs it (see tasks.md), not the `quality` job; a
  missing binary elsewhere surfaces as exit code `2` with a clear stderr
  message, not a silent false pass.
- **[Risk]** Aggregating "one broken change" into the same exit code `1`
  as "every change is broken" loses granularity a CI system might want
  (e.g., partial-failure vs. total-failure handling). → **Mitigation**:
  accepted for now — the JSON `results[]` array still carries per-change
  detail for any consumer that wants to distinguish further; only the
  process exit code itself is binary.

## Migration Plan

- No data migration; purely additive (`packages/cli` is a new package;
  `.github/workflows/quality.yml` gains one new job).
- Version: new package starts at `0.1.0`.
- Rollback: remove the new package and the CI step/job together; no
  persisted state to unwind.
