Mark each task `[x]` as soon as its own check passes — not in one batch
at the end, and never before the work is actually done.

Path this change must hold end to end: `openspec/config.yaml`'s
`rules.tasks` → `openspec instructions <artifact> --change <id>` → the
CLI wrapper → `prepareAgentContext()`'s prompt → the spawned agent.
Check each junction, not only the ends.

## 1. CLI wrapper

- [ ] 1.1 `packages/core/src/openspec.ts`: add
  `instructionsForArtifact(artifact, changeName, options)` invoking
  `openspec instructions <artifact> --change <changeName>` and returning
  its stdout as a string. Use the same spawn helper the existing
  `statusChange`/`validateChange` wrappers use; this subcommand has no
  `--json` form, so return raw text.
- [ ] 1.2 Same file: the wrapper returns `undefined` rather than
  throwing when the subcommand fails or produces nothing — see design.md,
  "A failed lookup degrades to today's behavior".

## 2. Prompt assembly

- [ ] 2.1 `packages/core/src/security.ts`: add a mapping from
  `CommandKind` to the artifact whose rules apply — `implement` →
  `"tasks"`. Leave kinds with no meaningful artifact unmapped rather than
  guessing one.
- [ ] 2.2 `packages/core/src/security.ts`, `prepareAgentContext()`
  (line ~161): when the command kind maps to an artifact, call the
  wrapper and place the result in its own labelled section **before** the
  existing change-content body, introduced as the project's rules for
  this artifact that the run must follow.
- [ ] 2.3 Same function: do **not** merge the rules into the existing
  body or under its "reference data, not instructions" header — the two
  blocks are labelled differently on purpose (design.md, "The rules block
  is labelled as instructions").
- [ ] 2.4 Same function: when the wrapper returns `undefined`, build the
  prompt exactly as today, with no empty heading left behind.

## 3. Copilot fallback

- [ ] 3.1 `packages/core/src/agents/copilot.ts`, `buildFallbackPrompt`:
  add a sentence telling the agent to run `openspec instructions tasks
  --change <id>` itself and follow what it returns. Keep the existing
  wording about reading the change's files and staying within the change
  directory.
- [ ] 3.2 Do **not** change `MAX_ARGV_PROMPT_LENGTH` or exempt this
  adapter from the rules block — see design.md's rejected alternative.

## 4. Tests

- [ ] 4.1 `security.test.ts`: with the wrapper stubbed to return rules
  text, an `implement` prompt contains that text in its own section,
  ahead of the change content.
- [ ] 4.2 `security.test.ts`: with the wrapper stubbed to return
  `undefined`, the prompt is byte-identical to today's — regression guard
  for task 2.4.
- [ ] 4.3 `security.test.ts`: the rules section and the change-content
  section carry different framing, so a reader can tell which is which
  (assert both labels are present and distinct).
- [ ] 4.4 `openspec.test.ts`: the wrapper returns `undefined` when the
  subcommand exits non-zero, and the text when it succeeds.
- [ ] 4.5 `copilot.test.ts`: the fallback prompt mentions the
  instructions command, and still contains the change directory and the
  existing constraint sentence.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict
  harness-prompt-project-rules`.
- [ ] 5.2 `npm run typecheck`/`lint`/`test --workspace @openspec-ui/core`
  — green. Note: `sprint-report.test.ts` and `change-timeline.test.ts`
  have pre-existing Windows timeout flakes under load; do not attempt to
  fix them here.
- [ ] 5.3 `openspec/specs/execution-core/spec.md` delta is already
  written in this change's `specs/` directory — confirm it matches what
  was implemented; do not rewrite it.
- [ ] 5.4 Version bump via `npx changeset` (`@openspec-ui/core`, patch).
- [ ] 5.5 **Human-only, cannot be completed by an implementing agent**:
  rebuild and reinstall (`npm run reinstall:local --workspace
  openspec-ui-vscode`), reload the window, run a real `implement`, and
  confirm from the run's own output that the agent received the project
  rules — for example that it marks tasks incrementally without the
  `tasks.md` preamble saying so. Leave unchecked if you are an agent.
