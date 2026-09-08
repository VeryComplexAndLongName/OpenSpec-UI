Four lines of YAML, and one of them is the whole change: `main` must
queue where a pull request cancels. A single `cancel-in-progress: true`
would look like the same fix and would break the path that matters most.

## 1. The group

- [x] 1.1 A workflow-level `concurrency` group keyed on the workflow and
  `github.ref`, so every push to `main` shares one group and each pull
  request gets its own.
- [x] 1.2 Keyed on the ref rather than the workflow alone: two unrelated
  pull requests contend for nothing, and queueing them would cost
  wall-clock on every review for no gain.
- [x] 1.3 At the workflow level, not on the release jobs alone. The
  workflow is the unit a person reasons about, and a partial grouping
  leaves the next reader holding which jobs overlap and which do not.

## 2. The asymmetry

- [x] 2.1 `cancel-in-progress` true for a pull request, false on `main` —
  `${{ github.ref != 'refs/heads/main' }}`.
- [x] 2.2 Say why in the file, both halves. A pull request's earlier run
  answers about a commit nobody will merge; a `main` run cancelled
  between tagging and releasing leaves a tag with no release attached.
  Written as a comment above the group, naming the two failures of
  2026-09-07 that prompted it — so the next person to simplify it reads
  the cost first.
- [x] 2.3 Do not use `cancel-in-progress: true` outright, however much it
  reads as the same fix.

## 3. Verification

- [x] 3.1 `openspec change validate --strict one-release-path-at-a-time`.
  Run 2026-09-08: "Change 'one-release-path-at-a-time' is valid".
- [x] 3.2 Parse the workflow and compare the **job list** before and
  after, not only that the YAML parses. A truncated workflow still
  parses, and two jobs were lost that way in this repository once.
  Parsed 2026-09-08: 9 jobs, the same 9 — browser-e2e, dependency-audit,
  dependency-review, extension-integration, openspec-validate, quality,
  release-extension, release-manifest, version-packages.
- [x] 3.3 `npm run typecheck`, `npm run lint`, `npm run test`. A
  regression check — no package source changes here.
  Run 2026-09-08: typecheck clean; lint clean apart from one warning
  that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 644 core,
  285 extension, 62 server, 267 webui — unchanged, as a CI-only change
  should leave them.
- [x] 3.4 No changeset: CI configuration, nothing published changes.
- [ ] 3.5 Confirm on this change's own pull request that the group is
  reported by GitHub — a run that shows no group would mean the
  expression did not evaluate, which is silent otherwise.
- [ ] 3.6 **Human-only**: at the next two merges in quick succession,
  confirm the second run waits rather than racing, and that no manual
  spacing was needed. That is the whole point, and it cannot be observed
  before two merges land close together.
