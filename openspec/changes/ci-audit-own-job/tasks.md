The point is that a network fault stops being indistinguishable from a
security finding. Moving the step to another job without that distinction
would leave the same red check on an unrelated pull request — just in a
narrower place.

## 1. Isolate

- [x] 1.1 `.github/workflows/quality.yml`: remove
  `npm audit --omit=dev --audit-level=high` from the `quality` job.
- [x] 1.2 Add a `dependency-audit` job that declares no `needs`, so it
  neither gates nor is gated by anything else. Give it its own
  `timeout-minutes`.
- [x] 1.3 Leave every existing `needs: quality` alone. Not running an
  integration suite against code that does not typecheck is deliberate
  and has nothing to do with the audit.

## 2. Tell the two faults apart

- [x] 2.1 Bound the audit command itself, not just the job. A job
  timeout kills the run and reports a red check — the outcome this
  change exists to stop. The command must give up first, on its own, so
  its exit can be interpreted.
- [x] 2.2 A high-severity advisory fails the check.
- [x] 2.3 An unreachable service, an error response, or the command's own
  timeout does **not** fail the check, and emits a workflow warning
  saying the audit could not be carried out.
- [x] 2.4 Say in a comment why the two are separated, naming the observed
  failure: seven minutes of retries against a `503` from
  `registry.npmjs.org/-/npm/v1/security/audits/quick`, killing a job
  whose work was already green.
- [x] 2.5 Do not let a missing or unparseable report read as "no
  vulnerabilities". If the audit produced no report that can be read, it
  did not run — the same distinction `AuditEntry.usage` draws between
  absent and zero.

## 3. Verification

- [x] 3.1 `openspec change validate --strict ci-audit-own-job`.
- [x] 3.2 Parse the workflow as YAML and confirm: `quality` no longer
  runs `npm audit`; `dependency-audit` exists and declares no `needs`;
  every other job's `needs` is unchanged from before.
- [x] 3.3 Exercise the interpreting script's three paths directly —
  a clean report, a report carrying advisories, and a report that is an
  error or missing — asserting the exit status of each. The failure this
  change addresses was in the *interpretation* of an exit status, so
  reasoning about the script without running it would repeat it.
- [x] 3.4 `npm run typecheck`, `npm run lint`, `npm run test`. No source
  changes, so this is a regression check, not a claim about the workflow.
- [x] 3.5 No changeset: CI configuration, nothing published changes.
- [ ] 3.6 **Human-only**: on the pull request itself, confirm the checks
  list now shows `Dependency audit` as its own entry alongside the
  others, and that the merge gate reports independently of it.
