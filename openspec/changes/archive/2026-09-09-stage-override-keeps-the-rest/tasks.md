Live in this repository: the base file sets `claude-opus-5` on three
stages and `claude-sonnet-5` on `apply`, and applying the "Balanced"
named configuration discards all four, because it writes stage entries
carrying no model.

## 1. The merge

- [x] 1.1 A stage entry present in both is merged field by field, with
  the change's fields winning.
- [x] 1.2 A change that names a different agent for the stage inherits
  nothing. Effort vocabularies differ per agent — `copilot` accepts seven
  values, `claude` five, `codex` four, and four agents accept none — and
  a budget is denominated in whichever unit its agent reports.
- [x] 1.3 A bare string counts as naming only the agent. It is the common
  case and the one that loses a model today.
- [x] 1.4 Nothing else about `mergeHarnessConfig` changes. The
  whole-object override of `budget`, `timeout`, `reviewGate` and
  `checkpoints` was argued deliberately and stays.

## 2. Tests

- [x] 2.1 Base sets model and effort, change sets effort only: the model
  survives.
- [x] 2.2 Base sets model, effort and budget, change names a different
  agent: nothing is inherited.
- [x] 2.3 A bare-string override keeps the base's model and effort for
  the same agent.
- [x] 2.4 A stage the change does not mention is untouched.
- [x] 2.5 Show it can fail: restore the wholesale replacement, confirm
  the tests report the lost fields, and put it back. Record what it said.
  Done 2026-09-09. Three of the seven failed, and they are the three that
  describe inheritance: `expected { agent: 'claude-cli-acp', ...(1) } to
  deeply equal { agent: 'claude-cli-acp', ...(2) }` for the effort-only
  override, `expected 'claude-cli-acp' to deeply equal { agent:
  'claude-cli-acp', ...(2) }` for the bare string, and the same shape for
  the budget. The four that describe what does not change kept passing,
  which is how it is visible that the assertions are about inheritance
  rather than about merging in general. Restored.

## 3. What this repository's own configurations do

- [x] 3.1 The named configurations write stage entries carrying an agent
  and an effort. With this merge they no longer erase a model — confirm
  by resolving against this repository's real base file rather than a
  fixture.
  Resolved against `openspec/agent-harness.json` as it stands:

      balanced  propose=claude-opus-5  review=claude-opus-5
                apply=claude-sonnet-5  verify=claude-opus-5
      fastest   propose=claude-opus-5  review=claude-opus-5
                apply=claude-sonnet-5  verify=claude-opus-5

  Before this change every one of those read `(none)`. `min-cost` still
  resolves to `claude-sonnet-5` throughout because it names that model
  itself — deliberately, since it exists to use the smaller one. Whether
  a named configuration should name a model at all is the next change's
  question, not this one's.

## 4. Verification

- [x] 4.1 `openspec change validate --strict stage-override-keeps-the-rest`.
  Run 2026-09-09: valid.
- [x] 4.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine.
  Run 2026-09-09 on an idle machine: typecheck clean; lint clean with no
  warnings. Tests 48 cli, 717 core, 304 extension, 62 server, 296 webui
  — core up 7.
- [x] 4.3 Version bump via `npx changeset` for `core`.
  Done: `.changeset/stage-override-keeps-the-rest.md`.
- [x] 4.4 `HARNESS.md` describes how the two files combine. Correct it.
  Done: the `stepAgents` bullet now says the entry merges field by field,
  states the different-agent exception with the reason, and records what
  the behaviour was before.
