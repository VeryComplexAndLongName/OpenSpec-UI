## 1. Fix

- [x] 1.1 `packages/core/src/agents/copilot.ts`: a `MAX_ARGV_PROMPT_LENGTH`
  constant (6000); if `commandInstruction(kind) + "\n\n" + prompt` exceeds
  it, build a short fallback prompt instead — names `command.context.
  changeDir` and instructs the agent to read `proposal.md`/`design.md`/
  `tasks.md`/any `specs/*/spec.md` there itself, plus the "work only
  within this directory" constraint. Below the threshold, behavior is
  unchanged (the full embedded prompt, as today).

## 2. Tests

- [x] 2.1 `copilot.test.ts` (2 new tests, 5 total, all green): a prompt
  under the threshold still embeds full content (existing behavior,
  unchanged); a prompt over the threshold produces the short fallback
  prompt instead (asserts the fallback names the changeDir, contains
  "read" and the "do not read or modify files under" constraint, and
  does NOT contain the oversized content); the fallback still uses
  positional-argv delivery unchanged (same `args[0]`/`args[2]`, no
  `stdin`). Found and fixed a latent bug in this test file while writing
  these: `spawnAndStreamMock` was never reset between tests, so every
  existing test's `.mock.calls[0]` silently referred to the *first*
  test's call, not its own — harmless before (every test happened to
  assert the same structural positions, true of any call), but would
  have made these two new content-sensitive tests falsely pass/fail
  against the wrong call. Added an `afterEach(() =>
  spawnAndStreamMock.mockReset())`.

## 3. Verification

- [x] 3.1 `openspec change validate --strict copilot-prompt-length-limit`
  — passes.
- [x] 3.2 typecheck/lint/test for `core` — all green (263 tests).
- [x] 3.3 Live verification: reproduced the real failure directly via
  `cross-spawn` with `changeset-version-automation`'s actual ~9.5KB
  prompt before the fix (`copilot exited with code 1`; raw stderr bytes
  decoded as CP866 read as the Russian-language OS text for "the command
  line is too long"). Did not re-run a full live `copilot`
  session after the fix (would cost real API credits testing something
  already conclusively established): the fix's correctness rests on two
  already-verified facts — short commands succeed (`copilot --help`,
  run live earlier this session, succeeded normally) and long ones fail
  exactly this way (reproduced above) — plus the unit tests confirming
  the fallback prompt (~350 characters) is far under the 6000-character
  threshold, itself with several hundred characters of margin under the
  measured ~8191-character `cmd.exe` limit.
- [x] 3.4 Version bump via `npx changeset` (`@openspec-ui/core`, `patch`)
  — `.changeset/copilot-prompt-length-limit.md` added, not yet applied.
