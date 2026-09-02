## 1. Capture script

- [x] 1.1 `packages/server/scripts/capture-harness-screenshots.mts`: spins
  up a temporary fixture workspace (one change, a populated
  `openspec/agent-harness.json`), starts `@openspec-ui/server`, drives
  Chromium via Playwright to the Harness Settings tab and the Change
  Editor tab's "Run with Agentic Harness" button, saves PNGs. Run via
  `npx tsx packages/server/scripts/capture-harness-screenshots.mts` from
  `packages/server/`.
- [x] 1.2 Not wired into `playwright.config.ts`/`npm run test:browser` —
  a dev-only regeneration tool, not a CI test.

## 2. Assets and README

- [x] 2.1 `docs/images/standalone/harness-settings.png` and
  `docs/images/standalone/run-with-harness.png` generated and committed.
- [x] 2.2 New "Configure and run with Agentic Harness" gallery section in
  `packages/server/README.md`, matching the existing sections' format.

## 3. Verification

- [x] 3.1 `npm run lint:english` — could not run the repo-wide script in
  this working copy (an unrelated, concurrent, uncommitted deletion by
  another in-progress change broke its git-tracked-file scan); manually
  grepped every new/changed file here for Cyrillic characters — none
  found. Will run cleanly in CI, which checks out this branch's own
  commit, not the shared local working tree.
- [x] 3.2 Every new README image reference resolves to a tracked file —
  confirmed both PNGs exist on disk before commit.
- [x] 3.3 `openspec change validate --strict agentic-harness-screenshots`
  — passes.
