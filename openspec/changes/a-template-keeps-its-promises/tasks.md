Found live, not by a test. The owner applied each template in a
disposable workspace on 2026-09-08 and read the saved file: Careful and
Thrifty correct; Overnight kept
`checkpoints.requireConfirmationBetweenSteps: true` while its own text
says "No checkpoints between stages".

## 1. The fix

- [x] 1.1 Overnight sets `checkpoints: { requireConfirmationBetweenSteps:
  false }`. It is per-change scoped already, which is what allows it.
- [x] 1.2 Change nothing else about it. Its ceilings were verified live
  and are correct.

## 2. The guard

- [x] 2.1 A test reading each template's own text for the claim "no
  checkpoints" and asserting the configuration sets it. It iterates the
  template list, so a fourth template making the same claim is covered
  without being named.
- [x] 2.2 And the converse: a template that turns confirmation off says
  so in its text. Silently removing the pauses is the same failure with
  the halves swapped — the configuration acting in a way the sentences
  never mentioned.
- [x] 2.3 Show it can fail: remove the new setting, confirm the test
  fails naming Overnight, and restore it. Record what it said.
  Done 2026-09-08: `"overnight" turns confirmation off if its text says
  it does not stop` failed with `expected undefined to be false`, and it
  alone — the other two templates make no such claim, so the guard is
  reading the text rather than asserting on everything. Restored.

## 3. Verification

- [x] 3.1 `openspec change validate --strict a-template-keeps-its-promises`.
  Run 2026-09-08: valid.
- [x] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 685 core,
  285 extension, 62 server, 276 webui — core up 6.
- [x] 3.3 Version bump via `npx changeset` for `core`.
  Done: `.changeset/a-template-keeps-its-promises.md`.
- [ ] 3.4 **Human-only**: apply Overnight once more in a disposable
  workspace and read the saved file. This came from a live check that no
  test had, and the same live check is what closes it.
