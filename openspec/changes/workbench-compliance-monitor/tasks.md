# Tasks

## 1. Policy and Core

- [x] 1.0 Record the cache-first/sweep-independent decisions in ADR-0049 and
  validate `workbench-compliance-monitor` strictly before implementation.
  Evidence: `openspec validate workbench-compliance-monitor --strict` passed
  on 2026-10-11; ADR-0049 decisions 11-14 preserve the existing sweep.

- [x] 1.1 Add ADR-0049 for the catalogue, host-owned idle scheduler, state
  location and repair boundary.
- [x] 1.2 Define stable compliance rule/result/config types and a core-owned
  catalogue linked to normative repository requirements.
- [x] 1.3 Add per-rule `autorepair`, `advice` and `none` settings, validation,
  global enablement and conservative defaults.
- [x] 1.4 Implement initialization checks and an idempotent `.gitignore` repair
  that preserves existing content and verifies the ignore rule semantically.
- [x] 1.5 Implement a pure planner that orders due checks by priority and
  measured/conservative cost within an idle-slice budget.
- [x] 1.6 Persist bounded settings and cost history outside the checkout,
  keyed by canonical Git common directory.
- [x] 1.7 Prevent concurrent checks and pause periodic work while the host is
  active or a mutating Workbench process holds the lease.
- [x] 1.8 Inventory OpenSpec changes across main and worktrees by stable id;
  report active/archive collisions, main shadow copies and missing index entries.
- [x] 1.9 Define runtime root expectations per artifact kind and report
  misplaced/untracked journals, audit/run logs and leases without moving them.
  `runtime-placement` enumerates paths without reading logs, states per-kind
  root contracts and returns unknown when producer provenance is insufficient.
  Verified by the runtime-path/log-content preservation test.
- [x] 1.10 Check README change links and stale worktrees against closed/archive
  state; compare logical ids without rewriting Pipeline directory cards.
  README checks apply only to a declared index. `groupComplianceChanges` groups
  ids across physical paths; stale readings reuse survey evidence and never
  change the directory cards or delete artifacts. Focused tests passed.
- [x] 1.11 Add `packages/core/src/compliance.ts` with typed bounded observations,
  cache-only snapshots, policy inheritance, known-finding retention and a
  one-step budgeted planner; verify in `compliance.test.ts`. Evidence: 17 tests
  passed on 2026-10-11 with Node 24.21.0 and one Vitest worker; cache reads
  perform no checks, Sweep never gains repair authority, and explicit reads
  retain serialization, minimum gaps, cancellation and backoff. Narrow
  TypeScript 6.0.3 checks with strict/noUncheckedIndexedAccess and ESLint checks
  passed for these two files. Later evidence is recorded below.
- [x] 1.12 Add atomic repository-identity cache persistence outside checkout;
  verify simultaneous host writes do not overwrite newer observations.
- [x] 1.13 Feed existing survey/sweep outcomes into the cache without changing
  `sweepWorkspace` scheduling, actions or settings; test no extra sweep is called.

## 2. Host and UI Integration

- [x] 2.1 Add shared settings and findings views with global enablement,
  per-rule reaction levels, last/next run, evidence and repair actions.
- [x] 2.2 Integrate VS Code idle state and commands through the shared core API.
- [x] 2.3 Integrate standalone browser-idle state through the same core API.
- [x] 2.4 Keep initialization feedback available when periodic monitoring is
  disabled; do not show a blocking dialog for advice-only findings.
- [x] 2.5 Add a lazy Compliance window with Results/Settings icon tabs and a
  shield action in Changes; opening and expansion must be cache-only.
- [x] 2.6 Add hierarchical tracking switches, reaction dropdowns and effective
  inheritance source; severity markers and whole-cache sort/filter controls.
- [x] 2.7 Stream live checked/changed timestamps and remove confirmed resolutions
  without losing focus/scroll; Read remaining exposes progress and cancellation.

## 3. Verification

- [x] 3.1 Test catalogue integrity, response validation, unknown rules and
  refusal to auto-repair rules without a safe repair implementation.
- [x] 3.2 Test `.gitignore` append, existing semantic ignore, negation,
  line-ending preservation, unreadable file and unrelated-content preservation;
  verify untracked runtime evidence remains unchanged apart from the managed ignore append.
- [x] 3.3 Test idle scheduling, budget boundaries, measured p95 ordering,
  conservative unknown costs, supported/unsupported CPU-time measurement,
  pause/resume and one-check-at-a-time behavior.
  Wall-time history and cursor persistence are tested. Child CPU attribution is
  unsupported and never guessed; resource guarantees are serialization,
  bounded subprocess time, gaps, idle admission and conservative cost.
- [x] 3.4 Test shared settings across sibling worktrees and prove no settings,
  findings or source contents are written into tracked repository files.
- [x] 3.5 Test same-id copies across worktrees group into one change; active and
  archived copies, main shadow artifacts and missing index entries are reported
  without moving or deleting any OpenSpec content. Verify README link advice,
  logical-copy grouping without changing existing Pipeline cards. Grouping,
  collision, shadow and README tests pass. Pure producer conversion verifies
  stale/branch/path attribution and preserves input data. Dirty paths not
  supplied by an existing producer remain unavailable rather than inferred.
- [x] 3.6 Test both hosts expose identical rule readings and enforce the same
  repair policy; a disabled monitor starts no periodic timer.
- [x] 3.7 Run focused core and host tests; leave full workspace regression to CI.
- [x] 3.8 Validate the change strictly and map each scenario to its test.
  Strict validation passed on 2026-10-11. Scenario coverage is listed below.
  Leave workspace-wide regression and release/archive operations to CI.

## Evidence (2026-10-11)

- PR #892 initial Quality run exposed command title/id/icon convention failures.
  Corrected registration to `openspec-ui.showCompliance` / `Show Compliance`,
  added the Compliance action noun and used the unique workspace-trusted icon.
  `action-vocabulary.test.ts` (4 tests) and `compliance-panel.test.ts` (1 test)
  passed locally with one worker before the corrective commit.

- `compliance.test.ts`, `compliance-store.test.ts`, `compliance-service.test.ts`:
  39 focused tests passed with one worker; bounded history, inheritance,
  retention, cooldown, ignore repair, active Git refusal and collision checks.
  Additional checks cover real Git equivalence/negation, binary preservation,
  shadow files, runtime provenance, README advice, one-worktree cursor resume,
  opt-in background repair and unknown Git evidence.
- `ComplianceView.test.tsx` and `ChangesList.test.tsx`: 11 tests passed.
- `compliance-rest.test.ts`: authenticated/cwd-isolated contract passed.
- `compliance-panel.test.ts`: extension bridge contract passed.
- `static.test.ts`: 7 tests passed including lazy chunk and traversal rejection.
- Core, server, webui and extension package typechecks passed; touched-file
  ESLint passed. Full workspace regression was not run locally.
- Standalone live smoke in a disposable Git repository: opening read cache,
  Read remaining reached zero, runtime-ignore repair removed its finding;
  mobile 390x844 had no horizontal overflow. Desktop and mobile screenshots
  were inspected; these are verification views, not published product images.
- `node packages/extension/src/test/compliance-run.mjs <installed Code.exe>`:
  live isolated VS Code smoke passed with exit code 0: activation, command,
  panel tab and disposal. No agent run or sweep was requested by Compliance.
- Minor changeset added for core/webui/server/extension. No commit, push,
  package release or archival is claimed.

## Scenario Coverage

- Repair safety fallback: 42 core tests and 4 Compliance UI tests passed on
  2026-10-11; explicit active
  Git/foreign-encoding refusals persist Advice, background autorepair preserves
  policy and bytes without immediate retries. Permission refusals remain errors.
  `ComplianceView.test.tsx` covers the persisted reason and explicit safe retry.
  Other-host contention preserves its lock; post-write verification failure
  remains an error and is never labelled as a no-write safety skip. Scoped
  core typecheck and touched-file lint passed.

- Catalogue/response/unsupported repair: `compliance.test.ts` policy tests and
  `compliance-service.test.ts` validates settings / never permits Sweep repairs.
- Unknown evidence and retention: `compliance.test.ts` retains known findings;
  `compliance-service.test.ts` unknown Git / runtime provenance tests.
- Initialization/semantic ignore/foreign content: service initialization,
  equivalent ignore/negation and binary preservation tests; live repair smoke.
- Runtime files preserved: service CRLF/audit-content and runtime-path tests.
- Logical copies/collisions/shadows/index/stale worktrees: service grouping,
  active/archive collision, shadow, README advice and pure survey tests.
- Silent/advice/autorepair/disabled tracking: core policy/planner tests,
  service explicit background autorepair and Sweep refusal tests.
- Serialized idle work/budget/gaps/cancellation/backoff: core planner/reader
  tests; inventory cursor test verifies one worktree per step across restart.
- Persistence/identity/cost bounds: store identity, merge, malformed-state and
  stale-writer tests; duration-history assertions and reader cost tests.
- Cache-only window/Sweep ownership/tab controls: `ComplianceView.test.tsx`
  and `compliance-panel.test.ts`; REST contract rejects sweep dispatch.
- Live timestamps/resolution/sorting/lazy rendering: cache checked/changed
  tests, live standalone completion/repair screenshots and UI control tests.
  `static.test.ts` verifies actual lazy chunk serving and traversal refusal.
- Host parity/security: authenticated REST contract, extension bridge contract,
  standalone browser smoke and real VS Code activation/panel/disposal smoke.