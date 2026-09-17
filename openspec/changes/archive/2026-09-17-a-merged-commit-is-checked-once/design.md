## Context

`quality.yml` has one trigger set, `pull_request` and `push` to `main`, and
every test job runs on both. The release jobs — `version-packages`,
`release-extension`, `release-manifest` — run only on a push to `main`, and
`needs` ties them to `quality` and `extension-integration` in the same run.

A squash merge's tree is the pull request branch's tree when that branch was
up to date with `main`. `main`'s ruleset ("Protect main from direct push")
requires a pull request and forbids force pushes, but requires no status
checks and not an up-to-date branch, so today the push run is the only check
of what actually lands when `main` moved in between.

The version pull request is the bot's branch `changeset-release/main`. It is
rewritten from `main` after every merge, so it is always up to date, and its
diff is versions, changelogs, `package-lock.json` and deleted changesets.

## Goals / Non-Goals

**Goals:**

- One full run of the checks per change.
- Nothing lands on `main` that its pull request's checks did not run on.
- The release path keeps running one at a time, uncancelled on `main`.

**Non-Goals:**

- Making a single job faster.
- `.gitea/workflows/quality.yml`.
- Removing the dependency audit or review from pull requests.

## Decisions

### Test jobs run on pull requests other than the version pull request

`quality`, `openspec-validate`, `extension-integration` and `browser-e2e`
take `if: github.event_name == 'pull_request' && github.head_ref !=
'changeset-release/main'`. `dependency-audit` runs on every pull request, the
version pull request included: it is 25 seconds and the lockfile changes
there. `dependency-review` keeps its condition.

### The version pull request gets a check of its own

A job named "Version pull request installs, builds and packages" runs only
on `changeset-release/main`: `npm ci` (which fails when the lockfile does not
describe the manifests), `npm run build`, and `npm run package --workspace
openspec-ui-vscode`, so the version that will be released is packaged before
it merges.

### The release path needs no test job

`version-packages` and `release-extension` lose `needs: quality` and `needs:
[quality, extension-integration]`. `release-extension` already packages the
VSIX itself, and a packaging failure fails it. `release-manifest` keeps
`needs: release-extension`. `dependency-audit` stops running on a push to
`main` too. The concurrency block is unchanged: a run on
`main` still queues and is never cancelled.

### Required checks, up to date

The `main` ruleset gains a required status checks rule with "require
branches to be up to date": the four test jobs and the dependency audit, and
later the version pull request's job. A job skipped by its `if` reports as skipped,
which satisfies a required check, so an ordinary pull request is not held by
the version job and the version pull request is not held by the browser
suite. The repository's "always suggest updating pull request branches" is
turned on, so an out-of-date pull request offers the update.

Without this rule, dropping the push run would leave a merge of an out-of-
date branch untested, which the push run catches today.

The version pull request's job is named in the rule only after it has run
once. A required check that no job reports is shown as "expected" and holds
every pull request, including the one that adds the job.

## Risks / Trade-offs

- **An out-of-date pull request needs one more run** after it is updated.
  That run checks what will land, which is the point; it replaces the run on
  `main` that checked it after the fact.
- **A setting outside the repository.** The ruleset is not a file, so the
  tasks record what was set and how it was read back.
- **Step 1 without step 2** would lose the only check of an out-of-date
  merge. The ruleset is set before the workflow change merges.
- **The first push run after merging** is the only proof of the release path
  in its new shape (release-quality: a step a pull request cannot run is not
  inferred from the pull request passing). It is watched and recorded.
