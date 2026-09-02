Mark each task `[x]` as soon as its own check passes — not in one batch
at the end, and never before the work is actually done.

## 1. Fix

- [x] 1.1 `packages/core/src/agent-detection.ts`: change
  `SPAWN_TIMEOUT_MS` from `3000` to `10000`.
- [x] 1.2 `packages/core/src/agent-detection.ts`: above that constant,
  add a comment recording why — measured on Windows while the machine was
  loaded, `copilot --version` took 4.96–6.51 s and `claude --version`
  1.61–2.72 s against the previous 3 s budget, so an installed CLI was
  reported absent. State that 10 s is headroom over the measured maximum,
  and that a genuinely missing executable still fails fast via
  `cross-spawn`'s `error` event rather than waiting out the timeout. Do
  **not** change `HTTP_TIMEOUT_MS` — it governs a different probe (see
  design.md Non-Goals).

## 2. Tests

- [x] 2.1 `packages/core/src/agent-detection.test.ts`: a probe whose
  spawned process exits normally resolves `true` — existing behavior,
  assert it is unchanged.
- [x] 2.2 `packages/core/src/agent-detection.test.ts`: a probe whose
  spawn emits an `error` event (missing executable) resolves `false`
  without waiting for the timeout. Use fake timers, or assert on the
  mocked child's `error` handler directly; do **not** write a test that
  actually sleeps 10 s.
- [x] 2.3 `packages/core/src/agent-detection.test.ts`: a probe that never
  exits resolves `false` after the timeout elapses, driven by fake
  timers — asserting the constant is actually the one used, not
  hardcoding 3000 in the test.

## 3. Verification

- [x] 3.1 `openspec change validate --strict agent-detection-timeout`.
- [x] 3.2 `npm run typecheck --workspace @openspec-ui/core` and
  `npm run lint --workspace @openspec-ui/core` — both clean.
- [x] 3.3 `npm run test --workspace @openspec-ui/core` — green. Note:
  `sprint-report.test.ts` has two pre-existing Windows `EBUSY` failures
  unrelated to this change; do not attempt to fix them here.
- [x] 3.4 `openspec/specs/execution-core/spec.md` delta is already
  written in this change's `specs/` directory — confirm it matches what
  was implemented; do not rewrite it.
- [x] 3.5 Version bump via `npx changeset` (`@openspec-ui/core`, patch).
- [x] 3.6 **Human-only, cannot be completed by an implementing agent**:
  open the agent picker on the machine that reported the problem and
  confirm `GitHub Copilot CLI` now annotates as detected. Leave unchecked
  if you are an agent; report it as outstanding.
