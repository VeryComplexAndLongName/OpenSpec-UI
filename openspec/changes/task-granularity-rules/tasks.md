## 1. Rules

- [ ] 1.1 `openspec/config.yaml`, `rules.tasks`: append a rule stating
  that one task covers one file and one verifiable outcome, and that a
  task naming two files or two behaviors must be split. Append it to the
  existing `rules.tasks` list — do **not** modify or reword the two rules
  already there, and do **not** touch `rules.proposal` or `rules.design`.
- [ ] 1.2 `openspec/config.yaml`, `rules.tasks`: append a rule requiring
  exact identifiers (function/command/symbol names), exact file paths and
  the exact expected result, instead of referring to "the relevant" or
  "the corresponding" code.
- [ ] 1.3 `openspec/config.yaml`, `rules.tasks`: append a rule stating
  that when a plausible-looking generalization of a task would be wrong,
  the task must state the prohibition explicitly.
- [ ] 1.4 `openspec/config.yaml`, `rules.tasks`: append a rule stating
  that a task an implementing agent cannot perform (live, interactive or
  manual verification) must be marked as such in the task text, and must
  be reported as outstanding rather than checked off.
- [ ] 1.5 `openspec/config.yaml`, `rules.tasks`: append a rule stating
  that the implementing agent marks each task `[x]` in `tasks.md` as soon
  as that task's own verification has passed — not in a single batch at
  the end of the run, and never before the task is actually done. State
  both halves: incremental marking is required, and marking ahead of the
  work is the failure this rule exists to prevent.

## 2. Verification

- [ ] 2.1 `openspec change validate --strict task-granularity-rules`.
- [ ] 2.2 `npx openspec instructions` (or the equivalent used by the
  propose flow) returns the four new rules — confirming they actually
  reach an agent, which is the whole point of putting them in
  `config.yaml` rather than `CLAUDE.md`.
- [ ] 2.3 `openspec/config.yaml` remains valid YAML and every other
  section (`context`, `rules.proposal`, `rules.design`, `operations.*`)
  is byte-identical to before this change — verify with
  `git diff openspec/config.yaml` showing additions inside `rules.tasks`
  only.
- [ ] 2.4 No changeset needed (process/tooling only, no `packages/*`
  change) — matches the precedent in
  `openspec/changes/archive/2026-08-31-internal-version-cascade/`.
