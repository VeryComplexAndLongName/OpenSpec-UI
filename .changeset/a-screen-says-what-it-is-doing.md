---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": patch
---

The standalone shell says what it is doing — and this release is where that
arrives. Extension 0.59.0 and 0.59.1, server 1.27.0 and webui 1.51.0 carried
an entry describing these features before they existed; that entry was
released early, and this is the release that delivers them.

- **Diff Preview shows a change's own diff.** Choose an active change and the
  tab shows what git reports for its folder against HEAD, staged edits and
  new files included, from a new token-gated `POST /api/change-diff`. A
  change with nothing uncommitted says so; a workspace that is not a git
  repository says that. The tab used to show a hard-coded two-line sample.
- **A tab that is reading says so.** A moving bar, a spinner and one sentence
  name what is being read, with the seconds elapsed once the wait passes
  three; the tab's controls are held until the reading returns; and the tab's
  label keeps a small spinner, so a tab left while it reads still shows it is
  busy. The animation stands still for a person who prefers reduced motion.
- **The theme control is a switch.** Its name stays "Dark theme", its state
  is `role="switch"` with `aria-checked`, and its knob slides and carries a
  sun or a moon.
