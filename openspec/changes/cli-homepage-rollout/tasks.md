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
- [ ] 1.3 Record producer PR checks and merge, followed by the changesets
  version PR checks/merge and successful release-manifest job.
  Producer draft PR #878 opened; Quality run 38082255993 is the first CI run.
  No producer merge, version release or npm publication is claimed yet.
- [ ] 1.4 Verify published `releases.json` contains public `ci-cli` and its npm
  link; record manifest branch commit, source commit and CLI version.
- [ ] 1.5 Verify `https://openspec-ui.dev` displays that CLI version in both
  sections and one correct npm button; record live browser/HTTP evidence.
- [ ] 1.6 Record final PR/run links, outstanding risks and whether any workflow
  failed. Archive only through the repository's normal sweep after verification.
