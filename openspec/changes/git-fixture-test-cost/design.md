## Context

See `proposal.md` for the measurement. Facts read from the two files:

- `initRepo()` is `git.init()` then two `git.addConfig(...)` calls —
  three subprocesses.
- `commitAll()` / `commitAllAs()` are `git.add(".")` then `git.commit(...)`
  — two more per commit. Dates and identity are supplied through
  `simpleGit(root).env({ GIT_AUTHOR_DATE, GIT_COMMITTER_DATE, ... })`.
- `afterEach` removes every temporary root created during the test.
- Both files repeat the same three helpers with small differences;
  neither imports the other's.

## Goals / Non-Goals

**Goals:**

- Bring both suites far enough under their timeout that ordinary co-load
  cannot tip them.
- Keep them exercising real `git`.
- Make the timeout each suite needs explicit and justified.

**Non-Goals:**

- Mocking `git`.
- Changing any assertion.
- Raising vitest's global default.

## Decisions

### Identity is set at `init`, not by two further subprocesses

`git init` can be followed by a single call that carries the identity, or
the identity can travel in the same `env` these helpers already use for
dates. Either removes two spawns per repository.

**Rejected alternative**: a global `git config --global` in test setup.
Rejected — it writes to the developer's own git configuration, and a test
suite that mutates the machine it runs on is worse than a slow one.

### Repositories are shared between tests that only read them

Tests that assert over the same repository shape build it once and reuse
it. Tests that need their own shape keep building their own.

**Rejected alternative**: one shared repository for the whole file.
Rejected — several tests deliberately construct different histories
(different authors, a commit that never touches the change directory, an
archived path), and forcing them onto one fixture would either weaken
what they assert or produce a fixture nobody can read.

**Rejected alternative**: keep a repository across files. Rejected — the
two files test different things and are run independently often enough
that a shared fixture would couple them for no gain.

### Each suite states its own timeout, with the number justified

The timeout is set per file, and a comment records what it was measured
against.

**Rejected alternative**: raise the timeout and change nothing else.
Rejected — it makes a slow suite officially slow. The measurement that
prompted this change (14.7 s for fourteen tests) would still stand, CI
would still spend it, and the next machine slower than this one would
fail again at the new number.

**Rejected alternative**: rely on the reduction alone and keep the
default. Rejected in the other direction — the remaining work is still
real subprocess work, and a suite that passes at 4.9 s on this machine is
one slower runner away from the same problem. Both halves are needed: the
reduction so the number is small, the explicit timeout so it is stated.

### The notes calling these failures expected are removed

Every `tasks.md` carrying "pre-existing Windows timeout flakes; do not
attempt to fix them here" describes a condition this change ends.

**Rejected alternative**: leave the notes, since they are harmless once
the tests pass. Rejected — this repository has already paid for a stale
"expected failure" note once this week. `npm run lint` was red for an
unrelated reason, every task list said so, and a real eslint error
reached CI unchecked because the red was expected. A note that outlives
its cause is not harmless; it is a trained reflex to ignore a signal.

## Risks / Trade-offs

- **[Risk]** A shared fixture lets one test's mutation leak into another,
  which is the classic cost of not rebuilding per test. → **Mitigation**:
  only tests that read share one, and the tasks require that constraint
  to be stated where the fixture is built, so the next person adding a
  test to that block knows the rule.
- **[Risk]** The measurement behind the new timeout is from one machine.
  → **Mitigation**: the number is set with headroom over the measured
  cost rather than close to it, on the same reasoning
  `ci-job-timeouts` used — a ceiling detects a hang, it does not budget
  performance, and it should be wrong in the cheap direction.
- **[Trade-off]** Two files keep their own near-identical helpers rather
  than sharing one module. Accepted for now; a third caller is what
  should trigger extracting them, and neither file imports the other
  today.

## Migration Plan

None. Test-only, with no assertion changed.

## Open Questions

None. The exact timeout value is a measurement the tasks require rather
than a decision left open.
