The screenshots come first. An article that references a picture which
does not exist yet is an article describing what someone intends to show.

## 1. What is captured

- [x] 1.1 The Run dialog, showing the resolved path, the reason naming
  the setting it read, and each stage's agent. This is the release's
  centrepiece and there is no picture of it.
  Captured as `docs/images/standalone/run-dialog.png`, and it earned its
  keep immediately: the agent list and the ceiling list rendered as one
  undifferentiated run of bullets, which no assertion would have
  reported. Headings added to `RunDialog.tsx` and the shot retaken.
- [x] 1.2 The per-change override section, which already has a capture —
  `harness-change-override.png` predates the per-change template picker,
  so the committed file shows a screen that no longer exists.
  Recaptured. The picker with all three templates is now in the image,
  Overnight included — which is the one that could not be reached from
  the UI at all until two changes ago.
- [x] 1.3 Nothing from the editor. Playwright drives a browser, and a
  hand-taken picture of a VS Code menu is exactly the kind that goes
  stale without anyone noticing.
- [x] 1.4 Captures are scoped to the section they illustrate unless the
  screen is taller than the viewport, following what the existing spec
  already does and says why.

## 2. The article

- [x] 2.1 Covers 0.40.0 through 0.43.0, picking up where the 0.37.3-0.40
  article stopped.
- [x] 2.2 Every figure it cites exists in the repository, captured by
  task 1.
- [x] 2.3 Every number in it is measured and says where it came from.
  This project has spent four changes on the difference between a figure
  that was computed and one that was observed; an article is not the
  place to lose it.
- [x] 2.4 Says what still does not work, not only what now does.
- [x] 2.5 A short companion post, kept beside the article rather than in
  a temporary directory. **Added at the owner's request**, and the second
  half of it is the correction: the previous one of these lived in a
  scratchpad, and "where is it" has now been asked twice. A deliverable
  nobody can find is not delivered.

## 3. Verification

- [x] 3.1 `openspec change validate --strict release-story-0-43`.
  Run 2026-09-08: valid.
- [x] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 702 core,
  296 extension, 62 server, 285 webui — unchanged, as a change that ships
  a document and two pictures should leave them.
- [x] 3.3 The screenshot spec passes and the images it writes are the
  ones committed — run it, then confirm the working tree is clean.
  Note for whoever runs it next: `npx playwright test` alone serves the
  previously built client, so a UI change will not appear in the capture.
  `npm run test:browser` builds first. Learned the slow way here — the
  first retake was byte-identical to the shot it was meant to replace.
- [x] 3.4 No changeset. This ships documentation and a test, and no
  package's behaviour changes.
- [ ] 3.5 **Human-only**: read the article against the product and say
  whether it describes the thing you have been using. It is written from
  changelogs and code, which is exactly how an article comes to describe
  what was intended rather than what shipped.
