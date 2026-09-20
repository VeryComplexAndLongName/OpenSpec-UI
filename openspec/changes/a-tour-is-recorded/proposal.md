## Why

The README and the articles that will follow it describe a product whose
point is motion: a run starts, says what it is doing, asks a question, is
stopped. A still picture shows the screen after all of that has happened.
Nobody has a recording, and a recording taken by hand is the one kind of
picture this repository has already been burned by: it carries whatever
was on the screen, and `pipeline.png` once carried an account name.

`lint:screenshots` now governs a `.gif` (an-article-directory-per-venue),
so the rule is ready for a recording. What is missing is the recording
and the script that makes it.

## What Changes

- A capture spec, `packages/server/e2e/tour.spec.ts`, drives the running
  standalone application through one short story against the fixture
  workspace and the fake agent runner, and writes two files:
  - `docs/images/standalone/tour.gif` - for the README, where a video does
    not play. At most 3 MB (aim for 2), 1280 pixels wide, at most 20
    seconds, at most 12 frames a second.
  - `docs/images/standalone/tour.webm` - for the project site and the
    articles, which accept it (site limit: 8 MB).
- The story: the Pipeline with three changes, one waiting on another, a run
  started from a change's card, its first checkpoint answered on the card,
  what the card says while a stage runs, and a stop with a reason that the
  card then states. The agent is the fake runner, so the
  recording is the same every time it is regenerated and spends no tokens.
- The workspace path is masked in every photograph, the way
  `documentation-screenshots.spec.ts` masks it in a still, and the spec
  fails before a photograph is taken if the account name or the fixture's
  path appears anywhere on the screen outside what is masked.
- Both files are built from photographs the spec takes of the screen at
  each step, each held for as long as a reader needs, so the waits between
  steps (a stage takes tens of seconds to start) cost nothing and the
  recording is as long as its story. The browser's own video would carry
  the waits and could not be masked. The GIF is written with a small
  encoder added as a dev dependency of `packages/server`, because the
  ffmpeg that ships with Playwright can write WebM and nothing else; the
  WebM is written by that ffmpeg, so this repository depends on no ffmpeg
  of its own.

## Capabilities

### New Capabilities

(none - a capture and its output)

### Modified Capabilities

(none)

## Impact

- `packages/server/e2e/tour.spec.ts` and, if the story needs a state the
  existing fixtures do not build, one fixture beside them.
- Two files under `docs/images/standalone/`.
- Two dev dependencies of `packages/server` (a GIF encoder and a PNG
  decoder), no runtime dependency, and nothing that ships in the VSIX or
  the server bundle.
- `README.md` shows the GIF at the top, in place of the still it shows
  now.
- No change to any capability, so no spec delta.

## Explicitly out of scope

- **A recording of the VS Code extension.** The story is told once, in the
  standalone application, which shows all of it. The extension has its own
  capture directory and can have its own recording later.
- **Narration, captions or sound.** The GIF is silent and the article
  around it carries the words.
- **Anything about the campaign.** Where the recording is posted is the
  article agent's and the owner's. This change only makes it exist, and
  regenerable.
