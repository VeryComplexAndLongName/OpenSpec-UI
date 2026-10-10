# Tasks

- [x] 1.1 Record merged Homepage CLI-visibility PR and successful Deploy run,
  with `/healthz` reporting its deployed revision.
  Verified 2026-10-10: Homepage PR #139, Checks run 38081166858 passed;
  Deploy 38081270215 passed. Public `/healthz` reported
  `4cab8359ed8128da184ad8397e1f9114e248da01`.
- [x] 1.2 Record merged Homepage Markdown PR and successful Deploy run, with
  live Current releases notes showing rendered Markdown safely.
  Verified 2026-10-10: Homepage PR #140; conflict-resolved head
  `a0d499ed2091712bf66fcd1484a3395c71e48402` passed Checks 38081595995.
  Deploy 38082132852 passed; public `/healthz` reports
  `2c6089189ee6e75f267f3346092688073c32514f`. Live release cards contain
  `div.os-release-note`, `strong` and `code` elements, not literal Markdown.
- [x] 1.3 Record producer PR checks and merge, followed by the changesets
  version PR checks/merge and successful release-manifest job.
  Verified 2026-10-10: producer #878 passed Quality 38082963354 and merged as
  765dc994d1ffce8d85c86c067a159735906bb7b7. Version PR #880 passed approved
  Quality 38083527960 and merged as 4589fa9e47ceb834edea41aec269dd84137c8712.
  Main run 38083657379 and manifest job 114305640839 passed.
- [x] 1.4 Verify published `releases.json` contains public `ci-cli` and its npm
  link; record manifest branch commit, source commit and CLI version.
  Verified immutable manifest 7b05a77b2f1f237d4100380021c6c809695401cd:
  source 4589fa9e47ceb834edea41aec269dd84137c8712, CLI 0.30.0, public true,
  npm URL `https://www.npmjs.com/package/@openspec-ui/cli`.
- [x] 1.5 Verify `https://openspec-ui.dev` displays that CLI version in both
  sections and one correct npm button; record live browser/HTTP evidence.
  Verified 2026-10-10 by curl of the public homepage: Current versions contains
  CLI 0.30.0; Current releases contains CLI / Version 0.30.0 and one npm button
  targeting the URL above. Live release-note HTML contains strong/code markup.
- [x] 1.6 Record final PR/run links, outstanding risks and whether any workflow
  failed. Archive only through the repository's normal sweep after verification.
  Homepage PRs #139/#140 and Deploy runs 38081270215/38082132852 succeeded.
  Producer #878 and version #880 succeeded after task evidence and workflow
  approval. Initial local Git Bash/timeout/WSL DNS failures were not bypassed;
  Linux CI supplied passing evidence. Archive Homepage #141 initially failed
  two index tests (551 passed); its two stale links were fixed in commit
  07b28e0336ccb481c7c84170f151ab58490f31a8 and rerun 38083862277 is tracked
  separately. No npm registry publication was requested or performed; the site
  reports repository versions, not a promise that npm holds the displayed version.
