The owner's question of 2026-09-16: why does one change run the checks four
times? Prepared that evening, to be carried out the next day.

## 1. The ruleset first

- [x] 1.1 **Owner's approval.** The `main` ruleset ("Protect main from direct
  push", id 20287422) gains a required status checks rule with "require
  branches to be up to date", naming the checks that exist today:
  "Typecheck, lint, test, and build", "OpenSpec change validation (merge
  gate)", "Extension integration and package", "Standalone browser and
  accessibility" and "Dependency audit". The repository's
  `allow_update_branch` is turned on. Set by the owner in the settings, or
  through `gh api` once the owner approves it; recorded with the rule as read
  back from `gh api repos/{owner}/{repo}/rulesets/20287422`.
- [x] 1.2 The version pull request's own check is NOT named yet: a required
  check no job reports holds every pull request as "expected", and that job
  exists only once section 2 merges. It is added in 4.2.

  Record, 2026-09-17: the owner approved it ("I consent to running gh and
  every command needed"). Applied with `gh api -X PUT
  repos/VeryComplexAndLongName/OpenSpec-UI/rulesets/20287422`, keeping the
  three rules it had (deletion, non_fast_forward, pull_request), and read
  back: `required_status_checks` with `strict_required_status_checks_policy:
  true` and the five checks, each with `integration_id` 15368 (GitHub
  Actions). `allow_update_branch` is `true`. The version pull request's job
  is not named, as 1.2 says.

## 2. The workflow

- [x] 2.1 `.github/workflows/quality.yml`: `quality`, `openspec-validate`,
  `extension-integration` and `browser-e2e` run only on a pull request whose
  head is not `changeset-release/main`, with a comment saying why.
- [x] 2.2 A job "Version pull request installs, builds and packages" runs
  only on `changeset-release/main`: `npm ci`, `npm run build`, `npm run
  package --workspace openspec-ui-vscode`, with a stated `timeout-minutes`
  and the measurement it was chosen from.
- [x] 2.3 `dependency-audit` runs on pull requests only; `version-packages`
  and `release-extension` no longer `need` a test job; `release-manifest`
  keeps `needs: release-extension`; the concurrency block is unchanged.
- [x] 2.4 The header comment of `quality.yml` says which event runs which
  jobs, and why a push to `main` does not repeat the checks.
- [x] 2.5 `README.md`: the merge gate runs on every pull request, not "on
  every push/PR".

## 3. Checks

- [x] 3.1 `openspec validate a-merged-commit-is-checked-once --strict`
  passes.
- [x] 3.2 `quality.yml` parses, and every `needs` names a job that exists.
- [x] 3.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:source-text` pass.

  Record, 2026-09-17: `openspec validate --strict` valid. `quality.yml`
  parses with `yaml`; its 10 jobs' `needs` all resolve; evaluating each
  job's condition for the three events gives: a change's pull request —
  quality, dependency-audit, openspec-validate, extension-integration,
  browser-e2e, dependency-review; the version pull request —
  dependency-audit, version-pr, dependency-review; a push to `main` —
  version-packages, release-extension, release-manifest. `lint:english`
  (after `git add`), `lint:changesets` and `lint:source-text` pass.

- [ ] 3.4 This change's pull request runs the four test jobs, the audit and
  the review, and skips the version pull request's job. Record the run.

## 4. After merging

- [ ] 4.1 The push run for the merge runs `version-packages`,
  `release-extension` and `release-manifest` and no test job, and completes.
  Record its jobs and duration.
- [ ] 4.2 The next version pull request's run runs its own job, the audit and
  the review, and skips the suites. Record its jobs and duration. Then, with
  the owner's approval, "Version pull request installs, builds and packages"
  is added to the ruleset's required checks, and read back.
- [ ] 4.3 A pull request opened before another merged is shown as out of
  date and cannot merge until updated. Record where it was seen.
- [ ] 4.4 One change's runs, end to end, set beside the table in the
  proposal.
