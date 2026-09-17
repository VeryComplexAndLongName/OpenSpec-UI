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

- [x] 3.4 This change's pull request runs the four test jobs, the audit and
  the review, and skips the version pull request's job. Record the run.

  Record, 2026-09-17: run 35185862563, 7 min 05 s — quality,
  openspec-validate, extension-integration and browser-e2e passed, the
  dependency audit and review passed, and "Version pull request installs,
  builds and packages", version-packages, release-extension and
  release-manifest were skipped.

## 4. After merging

- [x] 4.1 The push run for the merge runs `version-packages`,
  `release-extension` and `release-manifest` and no test job, and completes.
  Record its jobs and duration.
- [x] 4.2 The next version pull request's run runs its own job, the audit and
  the review, and skips the suites. Record its jobs and duration. Then, with
  the owner's approval, "Version pull request installs, builds and packages"
  is added to the ruleset's required checks, and read back.
- [x] 4.3 A pull request opened before another merged is shown as out of
  date and cannot merge until updated. Record where it was seen.
- [x] 4.4 One change's runs, end to end, set beside the table in the
  proposal.

  Record, 2026-09-17:
  - 4.1 — the merge's push run 35186499740 (433b640): version-packages,
    release-extension and release-manifest succeeded, the other seven jobs
    were skipped; 56 s. The pushes that followed kept that shape: #546's
    merge 35186791685, 1 min 05 s, which released openspec-ui-vscode 0.59.5;
    #549's 35188039773, 50 s; #550's 35188562623, 1 min 10 s, which released
    0.59.6.
  - 4.2 — version pull request runs 35186536107 (#546), 2 min 37 s with the
    version job itself 31 s, and 35188083936 (#550), 1 min 04 s: the version
    job, the audit and the review passed, and the four suites were skipped.
    Then, on the owner's consent to running gh, the version job was added to
    the ruleset's required checks with `gh api -X PUT`, and read back: six
    checks, strict.
  - 4.3 — #549 was opened before #548 and #546 merged. GitHub then showed it
    as behind, and the owner reported "This branch is out-of-date with the
    base branch". It was updated through the pull request's update-branch
    API, its checks ran again (35187520704, 6 min 39 s), and it merged.
  - 4.4 — #549, a patch to the extension, end to end: its pull request 6 min
    39 s, its merge 50 s, the version pull request 1 min 04 s, the version
    merge 1 min 10 s. Against the proposal's table (#545: 5 min 00 s, 6 min
    10 s, 6 min 22 s, 5 min 58 s), what follows the pull request fell from
    18 min 30 s to 3 min 04 s, and one full run of the checks is left.
