## Why

Specific risk raised in review on 2026-09-01, with a direct A/B from this
repository's own history on 2026-08-31, when the propose/apply split
(`openspec/agent-harness.json`: propose/review by one agent, `apply` by
another) was first exercised for real:

- **Granular tasks → correct implementation.**
  `tree-command-selection-feedback`'s `tasks.md` listed one task per
  affected command (2.1–2.15), naming each command's exact identifier and
  the exact argument to use for it, and explicitly stating for two of them
  (`revealTask`, `rollbackChange`) what *not* to add. The implementing
  agent produced a correct implementation on the first attempt — all 15
  commands, both special cases handled exactly as specified, 184 tests
  green — and correctly left the one task it could not perform (a live
  Extension Development Host smoke test) unchecked.

- **Vague tasks → false completion.**
  `changeset-version-automation`'s task 1.3 said "Verify via a real push
  to a test branch/fork ... that the job opens a Version Packages PR".
  The implementing agent marked it complete without doing it — the claim
  was caught only because a human re-read the task before committing, and
  it had to be rewritten to state what was actually verified. The task
  was also impossible as written (the job triggers only on `push` to
  `main`, so it cannot be observed before merge) — an ambiguity a more
  granular task would have exposed while it was being written.

A fifth rule addresses a related gap seen in the same run. The
implementing agent marked all 24 completed tasks **at the end**, in one
batch. That is a poor fit for how runs here actually behave: they are
long (minutes), silent (`--output-format text` streams nothing until it
finishes), and they do get interrupted. The Processes view already
computes a percent-complete from `tasks.md`'s checkboxes, so incremental
marking turns an all-or-nothing number into live progress, and leaves a
usable resume point when a run dies part-way. The opposite failure —
marking a task before doing it — is exactly what `changeset-version-
automation` 1.3 did, so the rule has to state both halves.

The implementing agent has none of the conversation that produced the
proposal: it sees only the change directory. `openspec/config.yaml`'s
`rules.tasks` already exists for exactly this and is mechanically
returned by `openspec instructions` to every propose/apply call, so rules
added there actually reach whoever writes and executes the tasks —
unlike `CLAUDE.md`, which only reaches Claude Code sessions and not the
`copilot`/`codex` CLIs used for `apply`.

## What Changes

- `openspec/config.yaml`, `rules.tasks`: five rules added alongside the
  two already there —
  1. one task = one file and one verifiable outcome; split a task that
     names two files or two behaviors;
  2. name exact identifiers (function, command, symbol), exact paths and
     the exact expected result, instead of "the relevant handlers";
  3. where a plausible-looking generalization would be wrong, state the
     prohibition in the task itself;
  4. a task that an implementing agent cannot perform (live, interactive
     or manual verification) must say so, so it is reported outstanding
     instead of being marked done;
  5. the implementing agent marks each task `[x]` as soon as that task's
     own verification passes — incrementally, not in one batch at the
     end, and never ahead of the work.
- No change to `rules.proposal`/`rules.design`, to `context`, or to any
  `operations.*` guidance.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — process/authoring rules, no product-facing behavior;
`.openspec.yaml` sets `skip_specs: true` accordingly)

## Impact

- `openspec/config.yaml` only.
- No `packages/*` source change and no changeset (tooling/process only),
  matching the precedent already set by
  `openspec/changes/archive/2026-08-31-internal-version-cascade/` and
  `openspec/changes/archive/2026-08-31-changeset-version-automation/`.
- Affects every future change's `tasks.md`, including those written by an
  agent that never sees this conversation.
