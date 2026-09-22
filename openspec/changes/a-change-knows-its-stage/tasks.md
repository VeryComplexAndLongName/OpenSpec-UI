ADR 0037 decisions 5 and 6, the third change of its series, started with
the owner on 2026-09-22.

## 1. The facts and the stages

- [x] 1.1 `change-stage-facts.ts`, a leaf the browser also has:
  - `playStages` plays the facts forward, and a send-back moves a change
    back;
  - `totalsOf` sums the time in each stage over every visit;
  - `stageFromFiles` gives the stage where nothing is dated;
  - the words for a duration and a visit.
- [x] 1.2 `change-stages.ts`: `readStageFacts`, `readChangeStage` and
  `readChangeStages`. The facts come from:
  - the commits that add `proposal.md` and `tasks.md`;
  - `git blame` of each closed task line, and the audit log's runs;
  - the pull request's times;
  - commits on the change's branch;
  - the history's send-backs.

  Every time is said once, in UTC.
- [x] 1.3 Every forge carries a pull request's `createdAt` and `mergedAt`:
  GitHub through `gh` and its API, GitLab and Gitea. The standings keep
  them.
- [x] 1.4 `git.ts` `commitTimesBetween`.

## 2. The CLI

- [x] 2.1 `stages [<change>]`: every active change with its stage, how long
  it has been there and who holds it, or one change's every stay and the
  time in each stage.

## 3. Documentation

- [x] 3.1 `README.md`: the CLI table and a section on the stages.

## 4. Checks

- [x] 4.1 Tests:
  - `change-stage-facts.test.ts`, 6;
  - `change-stages.test.ts`, 4, on real git with commits at named times,
    in the git-subprocess project;
  - the times from `gh`, GitHub's API, GitLab and Gitea;
  - `stages-command.test.ts`, 3.
- [ ] 4.2 Live, on this change itself: `stages a-change-knows-its-stage`
  after its pull request is opened reads Proposed and Planned from its
  commit, and In review from the pull request's time on GitHub.
- [ ] 4.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0.
- [ ] 4.4 The whole standalone browser suite passes.
- [x] 4.5 A changeset: core and the CLI, minor.
- [ ] 4.6 `openspec validate a-change-knows-its-stage --strict`, and the
  merge gate locally with `--base origin/main`.
