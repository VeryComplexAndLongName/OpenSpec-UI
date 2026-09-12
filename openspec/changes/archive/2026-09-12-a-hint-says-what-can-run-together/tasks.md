`readChangeReadiness` already knows which ready changes can be started
alongside each other, which has nowhere to run, and what any two would
collide over. Nobody is told; the facts are printed and the reader does
the rest.

## 1. The hint itself

- [x] 1.1 `packages/core/src/hints.ts` exports `Hint`
  (`{ id, kind, subject, because, commands }`) and
  `buildHints(report: ChangeReadinessReport, options: HintOptions): Hint[]`.
  It reads no file and spawns no process: everything it needs is in the
  report it is given.
- [x] 1.2 Kind `can-run-together`: every maximal set of ready changes
  that collide with none of each other, each with the `worktree add` and
  `run` lines for its members. Not one chosen set — see `design.md`.
- [x] 1.3 Kind `needs-a-worktree`: a ready change with no working
  directory of its own, carrying the exact `openspec-ui-cli worktree
  add <change>` line already present in `ChangeReadiness.needsWorktree`.
- [x] 1.4 Kind `held-by-a-finished-run`: a change whose worktree is held
  by a lease whose holder is gone, carrying `openspec-ui-cli lease
  release --cwd <worktree>`. Derive "gone" from the readiness report's
  own holder record; do not check a process here — core decides that in
  `releaseWorkspaceLease` and a second opinion would drift from it.
- [x] 1.5 `because` on every hint names the fact it came from, in the
  vocabulary `describeCollision` already uses. A hint whose reason is
  absent is not emitted.
- [x] 1.6 More maximal sets than `HintOptions.maxSets` (default 5) emits
  one hint saying how many there are and naming none. A truncated list
  reads as a recommendation, which is the thing this must not produce.
- [x] 1.7 `packages/core/src/hints.test.ts`: two compatible changes
  produce one set; three with one collision produce two sets; a change
  with no worktree produces `needs-a-worktree`; a stale holder produces
  `held-by-a-finished-run`; six sets produce the count-only hint; a
  report with nothing ready produces no hints and is not an error.

## 2. The switch

- [x] 2.1 `hints.enabled` in `openspec/agent-harness.json`, default
  `true`, validated by `packages/core/src/harness-config.ts` like every
  other key — an unknown value is rejected, not coerced.
- [x] 2.2 With `hints.enabled: false`, `buildHints` is not called at the
  call site, and the payload carries no `hints` key. Assert the function
  is not invoked, not merely that the array is empty: "computed and
  hidden" is a different promise than the switch makes.
- [x] 2.3 `HARNESS.md`'s key reference documents `hints.enabled`, its
  default, and that off means not computed.

## 3. Where it is seen

- [x] 3.1 `packages/server/src/rest.ts` includes `hints` on the readiness
  payload, and omits the key entirely when hints are off.
- [x] 3.2 The extension's bridge returns the same payload through the
  same core call. No second computation, and no hint computed in
  `packages/extension`.
  Nothing to wire, and the premise was wrong: the extension serves no
  readiness at all. `readChangeReadiness` appears nowhere in
  `packages/extension/src`, and `ALLOWED_TABS_VSCODE_EMBED` is
  `["run-a-command"]`, so the Pipeline tab — the surface these are shown
  on — is not one that embed offers. What the task exists to prevent
  holds trivially: no suggestion is computed in the extension, because
  the extension computes no readiness. Giving that host one is a
  capability of its own, not part of this change.
- [x] 3.3 `packages/webui/src/components/HintList.tsx` renders a hint as
  its subject, its `because`, and its commands as selectable text. It
  consumes `packages/webui/src/change-readiness-client.ts`, which both
  hosts already use; do not add a second client.
- [x] 3.4 A hint's commands are never a button that runs them. This
  change writes nothing and starts nothing; a control that ran a command
  would make it the kind of thing that does.
- [x] 3.5 `packages/webui/src/components/HintList.test.tsx`: a hint
  renders its reason and its commands; no hints renders nothing at all,
  not an empty panel with a heading.

## 4. In a terminal

- [x] 4.1 `openspec-ui-cli advise [--cwd <path>] [--format text|json]`
  in `packages/cli/src/advise-command.ts`, wired in
  `packages/cli/src/main.ts` with its own `USAGE` entry.
- [x] 4.2 Exit `0` whether or not there are hints — the question was
  answered either way, the same reasoning `ready` and `lease` use — and
  `2` where the report could not be built.
- [x] 4.3 `--format json` prints the `Hint[]` shape unchanged from core.
- [x] 4.4 `packages/cli/src/advise-command.test.ts`: hints exit 0, no
  hints exits 0 and says so in words, an unreadable workspace exits 2.

## 5. Verification

- [x] 5.1 This change validates strictly. `check(validate-change)`
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
  2026-09-12, exit 0 on the third attempt, and both earlier failures
  were real:

  1. `lint:source-text` found a **raw NUL byte** in `hints.ts`: the
     set-key separator was meant to be written as an escape sequence and
     went in as the control byte itself. That is the defect the check
     exists for — such a file compiles, passes its tests, and is skipped
     by `grep` as binary, so nobody reviews it. The separator is now
     `|`, which a change name cannot contain.

     And then again in this very item: writing *about* the byte put a
     second one into this file, after the passing verify and before the
     push. CI said so — the only failing check on the pull request — and
     it was merged anyway, because the command that waited for the
     checks and the command that merged were chained so that the second
     ran whatever the first reported. Both are corrected in
     `fix-a-nul-byte-in-the-record`. The rule that survives: name the
     character in words, never spell it out.
  2. `HarnessSettingsView.test.tsx`'s "keeps every accepted key when
     saving" fixture did not know about `hints`, so the settings view
     would have dropped the key on save — the same shape as the defect
     that once deleted every ceiling a template had set. Added to the
     fixture; the view already lays the form over the loaded file, so
     nothing else needed changing.

  Tests on the passing run: cli 119 across 12 files, core 1112 across
  79, vscode 327 across 24, server 84 across 4, webui 394 across 43 —
  2036 across 162 files, 0 failed.
- [x] 5.3 A changeset exists: `core` and `cli` minor, `server`,
  `webui` and the extension as their changes warrant.
  `check(changeset-present)`
- [x] 5.4 **Delegated to `claude-cli`**: in a repository with at least
  three active changes, run `openspec-ui-cli advise` and quote its
  output and exit code; then set `hints.enabled: false`, run it again,
  and quote the output and exit code. Evidence: both outputs verbatim.
  2026-09-12, on this repository (five active changes, none with a
  worktree of its own), exit **0**:

  ```
  a-doctor-says-what-would-stop-a-run is ready and has nowhere to run
    One workspace permits one mutating run, so a change without a working
    directory of its own cannot be started beside anything.
    $ openspec-ui-cli worktree add a-doctor-says-what-would-stop-a-run
  ```

  …and four more of the same shape, one per active change. Worth
  recording: **no `can-run-together` set was suggested**, which is
  correct rather than a gap — `canJoin` is empty for a change with no
  working directory, because the lease permits one mutating run per
  directory. The suggestion a reader gets is the one that would change
  that.

  With `hints: { "enabled": false }` in `openspec/agent-harness.json`,
  exit **0**: `Nothing to suggest here.`, and `--format json` printed
  `[]`. The configuration was restored afterwards.
- [x] 5.5 **Delegated to `claude-cli`** (was marked human-only; a second
  agent's review closes a check, and this was built by a different agent
  than the reviewer): with a dozen ready changes, the hint list is
  something a person reads rather than scrolls past. Whether advice is
  useful at that volume is the one thing that decides whether this
  capability was worth adding.
  2026-09-12. The repository has never had a dozen ready at once, so the
  state was built and `buildHints` asked for what the shell would
  render. Two shapes, because they fail differently: twelve that can all
  run together, and twelve in three colliding families.
  **The many-sets guard works.** The messy dozen produced 64 possible
  groupings and collapsed to one short line — "64 sets of changes could
  run together" with `openspec-ui-cli ready` — rather than sixty-four
  suggestions. That is the case this feature was most likely to drown
  in, and it does not.
  **One large set did not.** Twelve that can all run together produced
  one hint whose subject joined all twelve names with "and", followed by
  twelve command lines: a wall, and exactly the "scrolls past" this item
  asks about. `maxSets` caps how many sets are named and nothing capped
  the width of one.
  Fixed: past a few, the subject counts the rest — "alpha, beta, delta
  and 9 more can run at the same time". The commands still name every
  change, because those are the work and the reader needs all of them;
  it is the headline that had to be readable. A set of three or four is
  still named in full, since there is nothing there to spare anybody.
