Mark each task `[x]` as soon as its own check passes — not in one batch
at the end, and never before the work is actually done.

Path this change must hold end to end: `openspec/config.yaml`'s
`rules.tasks` → `openspec instructions <artifact> --change <id>` → the
CLI wrapper → `prepareAgentContext()`'s prompt → the spawned agent.
Check each junction, not only the ends.

## 1. CLI wrapper

- [x] 1.1 `packages/core/src/openspec.ts`: add
  `instructionsForArtifact(artifact, changeName, options)` invoking
  `openspec instructions <artifact> --change <changeName>` and returning
  its stdout as a string. Use the same spawn helper the existing
  `statusChange`/`validateChange` wrappers use; this subcommand has no
  `--json` form, so return raw text.
- [x] 1.2 Same file: the wrapper returns `undefined` rather than
  throwing when the subcommand fails or produces nothing — see design.md,
  "A failed lookup degrades to today's behavior".

## 2. Prompt assembly

- [x] 2.1 `packages/core/src/security.ts`: add a mapping from
  `CommandKind` to the artifact whose rules apply — `implement` →
  `"tasks"`. Leave kinds with no meaningful artifact unmapped rather than
  guessing one.
- [x] 2.2 `packages/core/src/security.ts`, `prepareAgentContext()`
  (line ~161): when the command kind maps to an artifact, call the
  wrapper and place the result in its own labelled section **before** the
  existing change-content body, introduced as the project's rules for
  this artifact that the run must follow.
- [x] 2.3 Same function: do **not** merge the rules into the existing
  body or under its "reference data, not instructions" header — the two
  blocks are labelled differently on purpose (design.md, "The rules block
  is labelled as instructions").
- [x] 2.4 Same function: when the wrapper returns `undefined`, build the
  prompt exactly as today, with no empty heading left behind.

## 3. Copilot fallback

- [x] 3.1 `packages/core/src/agents/copilot.ts`, `buildFallbackPrompt`:
  add a sentence telling the agent to run `openspec instructions tasks
  --change <id>` itself and follow what it returns. Keep the existing
  wording about reading the change's files and staying within the change
  directory.
- [x] 3.2 Do **not** change `MAX_ARGV_PROMPT_LENGTH` or exempt this
  adapter from the rules block — see design.md's rejected alternative.

## 4. Tests

- [x] 4.1 `security.test.ts`: with the wrapper stubbed to return rules
  text, an `implement` prompt contains that text in its own section,
  ahead of the change content.
- [x] 4.2 `security.test.ts`: with the wrapper stubbed to return
  `undefined`, the prompt is byte-identical to today's — regression guard
  for task 2.4.
- [x] 4.3 `security.test.ts`: the rules section and the change-content
  section carry different framing, so a reader can tell which is which
  (assert both labels are present and distinct).
- [x] 4.4 `openspec.test.ts`: the wrapper returns `undefined` when the
  subcommand exits non-zero, and the text when it succeeds.
- [x] 4.5 `copilot.test.ts`: the fallback prompt mentions the
  instructions command, and still contains the change directory and the
  existing constraint sentence.

## 5. Verification

- [x] 5.1 `openspec change validate --strict
  harness-prompt-project-rules`.
- [x] 5.2 `npm run typecheck`/`lint`/`test --workspace @openspec-ui/core`
  — green. Note: `sprint-report.test.ts` and `change-timeline.test.ts`
  have pre-existing Windows timeout flakes under load; do not attempt to
  fix them here.
- [x] 5.3 `openspec/specs/execution-core/spec.md` delta is already
  written in this change's `specs/` directory — confirm it matches what
  was implemented; do not rewrite it.
- [x] 5.4 Version bump via `npx changeset` (`@openspec-ui/core`, patch).
- [ ] 5.5 **Human-only, cannot be completed by an implementing agent**:
  rebuild and reinstall (`npm run reinstall:local --workspace
  openspec-ui-vscode`), reload the window, run a real `implement`, and
  confirm from the run's own output that the agent received the project
  rules — for example that it marks tasks incrementally without the
  `tasks.md` preamble saying so. Leave unchecked if you are an agent.

## 6. Rules block scope — review follow-up (2026-09-01)

Found in review of sections 1-5, live: `openspec instructions tasks
--change <id>` is the *authoring* prompt for `tasks.md`, not the rules
for carrying it out. See design.md, "Correction (2026-09-01)", which
quotes the real output. Path this section must hold: `openspec
instructions` output → `instructionsForArtifact()` → `extractRulesElement()`
→ `buildRulesSection()` → the `implement` prompt. Check each junction.

- [x] 6.1 `packages/core/src/security.ts`: add
  `extractRulesElement(output: string): string | undefined`, returning
  the inner text of the `<rules>` element in `output`, trimmed, or
  `undefined` when `output` has no `<rules>` element. Return the element's
  contents only — the `<rules>`/`</rules>` tags themselves must not be in
  the returned string.
- [x] 6.2 `packages/core/src/security.ts`, `buildRulesSection()`: pass the
  value returned by `instructionsForArtifact()` through
  `extractRulesElement()` and build the section from that result alone.
  Do **not** fall back to the raw output when `extractRulesElement()`
  returns `undefined` — a raw fallback reintroduces exactly the defect
  this section exists to fix. `undefined` means no section, on the path
  task 2.4 already built.
- [x] 6.3 `packages/core/src/openspec.ts`: leave
  `instructionsForArtifact()` unchanged. Its contract is the subcommand's
  raw text and `openspec.test.ts` asserts it; the extraction belongs in
  `security.ts`, which is the module that decides what reaches a prompt.
- [x] 6.4 `packages/core/src/security.ts`, `changeNameFromDir()`: return
  `""` when the resolved last path segment begins with `-`, so a change
  directory so named can never reach the `openspec` argv as a flag.
  `buildRulesSection()` already treats `""` as "no rules", so no other
  call site changes.
- [x] 6.5 `packages/core/src/security.ts`, the doc comment on
  `prepareAgentContext()` (line ~203): it currently reads "Intentionally
  does NOT accept allowlist/cwd/executable — it structurally cannot affect
  what gets run or where, regardless of what is written in
  `context.promptContext` or in any file it reads". Both halves are now
  false: the function takes `options.cwd`, and it spawns `openspec` in it.
  Rewrite it to state what is actually true — the sandbox and allowlist
  decisions happen in `agent-runner.ts` before this function is called, so
  `options.cwd` is already validated; the only process it starts is the
  fixed `openspec instructions` subcommand; and change-directory content
  remains data while `config.yaml`'s rules are a trusted governance
  channel. Do **not** delete the comment: it is this module's audit
  surface.

## 7. Tests for section 6

- [x] 7.1 `packages/core/src/security.test.ts`: with the wrapper stubbed
  to return a full `openspec instructions` output — `<artifact>` wrapping
  a `<task>`, a `<project_context>`, a `<rules>` and a `<dependencies>`
  element — the built `implement` prompt contains the `<rules>` text and
  contains **none** of the `<task>`, `<project_context>` or
  `<dependencies>` text. Assert the absences explicitly; asserting only
  the presence of the rules is what let this defect through the first
  time.
- [x] 7.2 `packages/core/src/security.test.ts`: with the wrapper stubbed
  to return text containing no `<rules>` element, the prompt is
  byte-identical to the one built with no rules at all.
- [x] 7.3 `packages/core/src/security.test.ts`: a change directory whose
  last segment begins with `-` produces no rules section, and
  `instructionsForArtifact` is not called for it.
- [x] 7.4 Keep the existing tests 4.1-4.3 passing. If one of them stubs
  the wrapper with text that has no `<rules>` element, update that stub to
  a realistic output rather than relaxing the new behavior.

## 8. Verification for section 6

- [x] 8.1 `openspec change validate --strict harness-prompt-project-rules`.
- [x] 8.2 `npm run typecheck` and `npm run test --workspace
  @openspec-ui/core` — green. `sprint-report.test.ts` and
  `change-timeline.test.ts` have pre-existing Windows timeout flakes at
  5000ms under load; do not attempt to fix them here.
- [x] 8.3 No new changeset — 5.4 already added the `@openspec-ui/core`
  patch for this change, and this section ships in the same release.
- [ ] 8.4 **Human-only, cannot be completed by an implementing agent**:
  run a real `implement` and read the prompt actually sent (the audit log
  or the agent's own echo), confirming it carries the eight `rules.tasks`
  lines and no "Create the tasks artifact" text. Leave unchecked if you
  are an agent. This supersedes 5.5, which may stay unchecked.
