`readChangeReadiness` already knows which ready changes can be started
alongside each other, which has nowhere to run, and what any two would
collide over. Nobody is told; the facts are printed and the reader does
the rest.

## 1. The hint itself

- [ ] 1.1 `packages/core/src/hints.ts` exports `Hint`
  (`{ id, kind, subject, because, commands }`) and
  `buildHints(report: ChangeReadinessReport, options: HintOptions): Hint[]`.
  It reads no file and spawns no process: everything it needs is in the
  report it is given.
- [ ] 1.2 Kind `can-run-together`: every maximal set of ready changes
  that collide with none of each other, each with the `worktree add` and
  `run` lines for its members. Not one chosen set — see `design.md`.
- [ ] 1.3 Kind `needs-a-worktree`: a ready change with no working
  directory of its own, carrying the exact `openspec-ui-cli worktree
  add <change>` line already present in `ChangeReadiness.needsWorktree`.
- [ ] 1.4 Kind `held-by-a-finished-run`: a change whose worktree is held
  by a lease whose holder is gone, carrying `openspec-ui-cli lease
  release --cwd <worktree>`. Derive "gone" from the readiness report's
  own holder record; do not check a process here — core decides that in
  `releaseWorkspaceLease` and a second opinion would drift from it.
- [ ] 1.5 `because` on every hint names the fact it came from, in the
  vocabulary `describeCollision` already uses. A hint whose reason is
  absent is not emitted.
- [ ] 1.6 More maximal sets than `HintOptions.maxSets` (default 5) emits
  one hint saying how many there are and naming none. A truncated list
  reads as a recommendation, which is the thing this must not produce.
- [ ] 1.7 `packages/core/src/hints.test.ts`: two compatible changes
  produce one set; three with one collision produce two sets; a change
  with no worktree produces `needs-a-worktree`; a stale holder produces
  `held-by-a-finished-run`; six sets produce the count-only hint; a
  report with nothing ready produces no hints and is not an error.

## 2. The switch

- [ ] 2.1 `hints.enabled` in `openspec/agent-harness.json`, default
  `true`, validated by `packages/core/src/harness-config.ts` like every
  other key — an unknown value is rejected, not coerced.
- [ ] 2.2 With `hints.enabled: false`, `buildHints` is not called at the
  call site, and the payload carries no `hints` key. Assert the function
  is not invoked, not merely that the array is empty: "computed and
  hidden" is a different promise than the switch makes.
- [ ] 2.3 `HARNESS.md`'s key reference documents `hints.enabled`, its
  default, and that off means not computed.

## 3. Where it is seen

- [ ] 3.1 `packages/server/src/rest.ts` includes `hints` on the readiness
  payload, and omits the key entirely when hints are off.
- [ ] 3.2 The extension's bridge returns the same payload through the
  same core call. No second computation, and no hint computed in
  `packages/extension`.
- [ ] 3.3 `packages/webui/src/components/HintList.tsx` renders a hint as
  its subject, its `because`, and its commands as selectable text. It
  consumes `packages/webui/src/change-readiness-client.ts`, which both
  hosts already use; do not add a second client.
- [ ] 3.4 A hint's commands are never a button that runs them. This
  change writes nothing and starts nothing; a control that ran a command
  would make it the kind of thing that does.
- [ ] 3.5 `packages/webui/src/components/HintList.test.tsx`: a hint
  renders its reason and its commands; no hints renders nothing at all,
  not an empty panel with a heading.

## 4. In a terminal

- [ ] 4.1 `openspec-ui-cli advise [--cwd <path>] [--format text|json]`
  in `packages/cli/src/advise-command.ts`, wired in
  `packages/cli/src/main.ts` with its own `USAGE` entry.
- [ ] 4.2 Exit `0` whether or not there are hints — the question was
  answered either way, the same reasoning `ready` and `lease` use — and
  `2` where the report could not be built.
- [ ] 4.3 `--format json` prints the `Hint[]` shape unchanged from core.
- [ ] 4.4 `packages/cli/src/advise-command.test.ts`: hints exit 0, no
  hints exits 0 and says so in words, an unreadable workspace exits 2.

## 5. Verification

- [ ] 5.1 This change validates strictly. `check(validate-change)`
- [ ] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 5.3 A changeset exists: `core` and `cli` minor, `server`,
  `webui` and the extension as their changes warrant.
  `check(changeset-present)`
- [ ] 5.4 **Delegated to `claude-cli`**: in a repository with at least
  three active changes, run `openspec-ui-cli advise` and quote its
  output and exit code; then set `hints.enabled: false`, run it again,
  and quote the output and exit code. Evidence: both outputs verbatim.
- [ ] 5.5 **Human-only**: with the standalone shell open on a repository
  that has a dozen ready changes, the hint list is something a person
  reads rather than scrolls past. Whether advice is useful at that
  volume is a judgement, and it is the one thing that decides whether
  this capability was worth adding.
