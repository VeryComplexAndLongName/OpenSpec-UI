## 1. Ledger Core

- [x] 1.1 Add `packages/core/src/process-ledger.ts` with the snapshot type,
  SHA-256 command-line hashing, bounded persistence and exit marking.
- [x] 1.2 Add `packages/core/src/process-start-time.ts` with per-OS start-time
  readers; verify a failure records unavailable rather than guessing.
- [x] 1.3 Write the snapshot synchronously in `spawnAndStream` after the child
  reports a PID; verify `process-ledger.test.ts` records run, pid, start time,
  executable, hostname, cwd, change and hash but never raw arguments.
- [x] 1.4 Write the snapshot in `acp-session-driver` spawn; verify the same
  contract as 1.3.
- [x] 1.5 Mark `exitedAt` on process close in both adapters; verify the ledger
  retains the record with an exit time.

## 2. Overdue and Orphan Rules

- [x] 2.1 Add `process-overdue` and `process-orphan` rules to the Compliance
  catalogue with no repair; verify `autorepair` resolves to advice.
- [x] 2.2 Map a snapshot to its expected duration using short defaults for
  known tool subprocesses; unknown limits are reported, never presumed safe.
- [x] 2.3 Surface overdue/orphan findings with snapshot evidence in the shared
  Compliance window; verify opening reads cached data and terminates nothing.
  Evidence: the process rules render through the existing generic window and
  the read-only assertion is in process-ledger.test.ts; no terminate path exists
  in Compliance.

## 3. Re-verified Termination

- [x] 3.1 Add `verifyProcessSnapshot(pid, snapshot)` that re-reads start time
  and compares hostname; verify PID reuse refuses the kill.
- [x] 3.2 Add a confirmable terminate action to the recovery/processes surface
  that lists the tree, re-verifies and calls `terminateProcessTree`.
  Evidence: server `POST /api/processes/ledger` and `/terminate`, the standalone
  ProcessesView "Detached processes" section, and the VS Code
  `openspec-ui.terminateLedgerProcess` command all re-verify before killing.
- [x] 3.3 Verify Compliance has no path to terminate and that background
  Compliance work never issues a kill.
  Evidence: `dispatchCompliance` has no terminate operation, and the process
  rules carry no repair; process-ledger.test.ts asserts autorepair resolves to
  advice.

## 4. Verification

- [x] 4.1 Test snapshot capture, exit marking, bounded retention and
  hostname-keyed placement with temporary fixtures; no real orphan is spawned.
- [x] 4.2 Test PID-reuse refusal, unavailable start-time refusal and matching
  termination through a fake process-tree helper.
- [x] 4.3 Test overdue mapping, unknown-limit conservatism and read-only
  Compliance findings.
- [x] 4.4 Run focused core tests and affected core/server/extension typechecks;
  leave the full regression and a live orphan smoke to CI and a documented
  delegated run.
- [x] 4.5 Validate the change strictly and map each scenario to its test.

## Evidence (2026-10-11)

- `process-ledger.test.ts` (13 tests) plus the directly affected `shared`,
  `acp-session-driver` and `compliance-service` suites pass: 71 core tests,
  one worker.
- `ProcessesView.test.tsx` (15 tests) and `process-ledger-rest.test.ts`
  (1 test) cover the detached-process list/terminate surfaces; the REST test
  proves an unverifiable PID is refused before any process-tree kill.
- `action-vocabulary.test.ts` and `control-vocabulary.test.ts` pass for the new
  `Terminate Ledger Process` command and `Terminate Process...` button.
- Core, server, webui and extension package typechecks pass; touched-file
  ESLint passes; strict OpenSpec validation passes.
- Ledger capture is opt-in via `setProcessLedgerStateRoot`, called by the
  extension activation and the server CLI, so tests that mock a spawn write
  nothing into a developer's home directory. Process findings are fed from the
  ledger at the existing survey/sweep recording points.
- A live orphan smoke (real spawned process surviving a restart, then killed
  after re-verification) is left to CI or a documented delegated run; no such
  live process is created in local tests.

## Scenario Coverage

- Spawn recorded / start time unavailable / exit marked / cross-host placement:
  process-ledger tests; start-time failure refuses a kill rather than guessing.
- PID reuse / matching kill: verifyProcessSnapshot and terminateLedgerProcess
  tests use injected readers and a fake terminator.
- Overdue / orphan / unknown limit, read-only: complianceProcessObservations
  tests; the process rules carry no repair, so autorepair resolves to advice.
- Confirmable terminate, both hosts: ProcessesView lists and confirms before
  calling the API; the REST route and VS Code command re-verify before
  `terminateProcessTree`; Compliance has no terminate path.
