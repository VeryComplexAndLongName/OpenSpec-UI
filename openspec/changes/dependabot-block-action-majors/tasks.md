One line of config, and the reason it exists has to survive in the file —
the npm rule above it is only still correct because its comment records
what taught it.

## 1. Policy

- [x] 1.1 `.github/dependabot.yml`: add an `ignore` block to the
  `github-actions` ecosystem with `dependency-name: "*"` and
  `update-types: ["version-update:semver-major"]`, matching the npm
  ecosystem's existing rule.
- [x] 1.2 Comment it with the reason that is specific to actions rather
  than repeating the npm one: a release-path action's job is gated to
  `main`, so a pull request that changes it never runs it, and a green
  pull request says nothing about the change. Name PR #207 as the case.
- [x] 1.3 Do not touch the npm ecosystem's rules. The `@types/vscode`
  entry in particular is not redundant with the blanket rule — it catches
  a compatibility break that arrives as a semver *minor*, which is why it
  exists separately.

## 2. Close the pull request it was written for

- [x] 2.1 Close PR #207 with a comment saying why it is closed and where
  the migration is being done instead, so the next person does not read
  it as a rejection of the version itself.

## 3. Verification

- [x] 3.1 `openspec change validate --strict dependabot-block-action-majors`.
- [x] 3.2 Parse `.github/dependabot.yml` and assert both ecosystems carry
  a blanket major ignore, and that npm's `@types/vscode` rule is still
  present. Reading the diff is not the same as confirming the file still
  parses into the two policies it is supposed to hold.
- [x] 3.3 `npm run typecheck`, `npm run lint`, `npm run test`. No source
  changes; this is a regression check.
- [x] 3.4 No changeset: repository configuration, nothing published
  changes.
- [ ] 3.5 **Delegated to copilot-cli**: after the first weekly Dependabot
  run following 2026-09-04 — the commit that added the rule, #214 — list
  the pull requests it opened and confirm the `github-actions` ecosystem
  produced no major bump, and that a minor or patch bump arrived if one
  was available. Evidence to record here: the `gh pr list` output and the
  run's date, quoted. The first such run is due 2026-09-10 at about 22:25
  UTC; a partial reading taken before it is recorded in the change, not
  as a tick.

  Partial reading, 2026-09-10 by `copilot-cli`: no Dependabot pull
  request of any ecosystem exists with `createdAt > "2026-09-04"`. The
  three most recent (#207, #208, #209) were opened 2026-09-03, before
  the rule landed. Nothing to confirm yet, and the agent said so rather
  than confirming — see a-live-check-names-who-performs-it item 6.1 for
  the run it was quoted from.
