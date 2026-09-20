Asked for by the owner on 2026-09-20 for the README and for the launch
articles.

## 1. The story is fixed before it is recorded

- [x] 1.1 Write the storyboard as a comment at the top of
  `packages/server/e2e/tour.spec.ts`: each step, what is on screen, and how
  long it holds. Twenty seconds at most, twelve frames a second at most.
- [x] 1.2 Check every state the story needs against the fixtures that
  exist (`create-lifecycle-workspace.ts`, `fake-agent-runner.ts`,
  `pipeline.spec.ts`), and add a fixture only for what is missing.

## 2. The capture

- [x] 2.1 `tour.spec.ts` runs the story against the fake runner and waits
  on the element that makes each step worth showing before it takes a
  frame, so a changed screen fails here instead of being recorded.
- [x] 2.2 The fields that print the workspace path are masked in every
  photograph, and the spec fails before one is taken if the account name or
  the fixture's path appears anywhere on the screen outside what is masked.
- [x] 2.3 The spec writes `docs/images/standalone/tour.gif` and
  `docs/images/standalone/tour.webm` from the same photographs, holding
  each for as long as a reader needs, and names the GIF.
- [x] 2.4 The spec fails when the GIF exceeds 3 MB, 1280 pixels wide, 20
  seconds or 12 frames a second.

## 3. The README shows it

- [x] 3.1 `README.md` shows `docs/images/standalone/tour.gif` at the top,
  with alternative text saying what the recording shows.
- [x] 3.2 The still it replaces stays: `packages/server/README.md` still
  links `run-command.png`, so nothing is removed.

## 4. Checks

- [x] 4.1 `npm run lint` after `git add`, and `npm run test` at the root,
  one suite at a time.

  Done 2026-09-20: `lint`, `lint:screenshots` ("44 pictures: 44 captured")
  and `typecheck` green. `test` passed except one test,
  `packages/webui/scripts/build-metro-icons.test.mjs` (the shipped icon
  stylesheet), which fails identically on a clean `origin/main` and which
  this change does not touch. Its cause is line endings: a generated file
  is checked out with CRLF on Windows, and the test compares bytes.
- [x] 4.2 `npm run test:browser` in `packages/server`, the whole suite, not
  only the new spec.

  Done 2026-09-20: the first whole run failed three specs (a checkpoint
  picture, concurrent hosts, and the Pipeline's start-and-stop) while
  another agent's suite was running on the same machine. Run alone, those
  three files passed (6 of 6), and the new spec passed in the whole run.
- [x] 4.3 Look at the recording and at the GIF frame by frame, and confirm
  that no path, account name or host name appears in any frame.
  Human-only: a check run by a script cannot say what a viewer sees.

  Confirmed by the owner on 2026-09-20, after looking at the recording.
- [x] 4.4 A changeset only if something under `packages/` ships; a capture
  spec and dev dependencies do not, so none is expected.
