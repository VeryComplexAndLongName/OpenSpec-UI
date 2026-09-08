The lint rule reported this all along — `'killTimer' is assigned a value
but never used` — and it was dismissed as pre-existing in every
verification run recorded today. The variable exists to be cleared.

## 1. The fix

- [x] 1.1 Clear the kill-confirmation timer where the abort listener is
  already removed. One line, in the block that already exists for exactly
  this kind of cleanup.
- [x] 1.2 Change nothing about the timeout's value or what it reports.
  Both were argued in `cancel-reports-what-happened`.

## 2. Tests

- [x] 2.1 A cancelled run whose child exits leaves no timer armed,
  asserted with fake timers on the count rather than on a side effect —
  the leak has no observable effect today, which is why nothing caught
  it.
- [x] 2.2 The path that arms the timer and needs it still works: a
  process that outlives termination still reports `failed`. The existing
  test covers this; confirm it still passes rather than adding a second.
- [x] 2.3 Show it can fail: revert the clear, confirm the new test
  reports a timer left armed, and restore it. Record what it said.
  Done 2026-09-08: `expected 1 to be +0`, and it alone — the eight other
  tests in the file passed, which is how it is visible that the assertion
  is on the leak rather than on the cancellation path in general.
  Restored.

## 3. Verification

- [x] 3.1 `openspec change validate --strict kill-timer-is-cleared`.
  Run 2026-09-08: valid.
- [x] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. The lint warning this fixes has been in every recorded run
  today; confirm the count goes to zero.
  Run 2026-09-08 on an idle machine: typecheck clean; **lint clean with
  no warnings at all**, for the first time in any run recorded today —
  every earlier entry carried this one. Tests 48 cli, 703 core, 301
  extension, 62 server, 293 webui — core up 1.
- [x] 3.3 Version bump via `npx changeset` for `core`.
  Done: `.changeset/kill-timer-is-cleared.md`.
