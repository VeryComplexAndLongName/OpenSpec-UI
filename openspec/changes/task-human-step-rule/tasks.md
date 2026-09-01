## 1. Rule

- [x] 1.1 `openspec/config.yaml`, `rules.tasks`: append one rule to the
  end of the existing list, stating that an implementing agent SHALL
  skip a human-only task, continue with the remaining tasks, and report
  it outstanding — it never stops to wait for a human inside a run —
  and that an author who needs the run to block must express that
  through `autonomyLevel` (`assisted`, or `semi-autonomous` with
  `checkpoints.requireConfirmationBetweenSteps`), not through task text.
  Append only: do **not** reword or renumber any of the eight rules
  already in `rules.tasks`, and do **not** touch `rules.proposal`,
  `rules.design`, `context`, or `operations.*`.
- [x] 1.2 The new rule must **not** be phrased as a replacement for the
  existing rule "A task that an implementing agent cannot perform ...
  must be reported as outstanding rather than checked off". That rule
  says how such a task is *marked*; this one says what the agent *does*
  when it reaches one. Both stay, and the new rule must read as
  complementary to it rather than restating it.

## 2. Verification

- [x] 2.1 `git diff openspec/config.yaml` shows additions inside
  `rules.tasks` only — every other section (`context`,
  `rules.proposal`, `rules.design`, `operations.*`) byte-identical to
  before this change.
- [x] 2.2 `openspec/config.yaml` still parses as valid YAML — confirm
  with `npx openspec change validate --strict task-human-step-rule`,
  which fails to load the project if it does not.
- [x] 2.3 `npx openspec instructions` includes the new rule in its
  returned `rules.tasks`, confirming it reaches an agent that never
  reads `CLAUDE.md`.
- [x] 2.4 No changeset is added (process/tooling only, no `packages/*`
  change) — matches the precedent in
  `openspec/changes/archive/2026-09-01-task-granularity-rules/`.
