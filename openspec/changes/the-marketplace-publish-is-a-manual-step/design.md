## Context

`release-extension` runs on a push to `main`, packages the VSIX, creates
the annotated tag `openspec-ui-vscode@<version>` and publishes a GitHub
Release with the `.vsix` attached. `extension-integration` has already
exercised that build in a real Extension Host on the pull request. The
Marketplace is fed by nothing in this repository; `@vscode/vsce` is a
devDependency of `packages/extension` and is used for `vsce package`
alone.

The workflow file states its own rules in comments: which event runs what,
and why the release path is never cancelled. This change adds a path that
runs on no event at all unless somebody asks.

## Goals / Non-Goals

**Goals:**

- A Marketplace publish happens only when a person names a version and
  asks for it.
- What is published is the artifact that was released, not a rebuild of
  whatever `main` holds now.
- The token is readable by that one job, and by nothing else.
- The guarantees survive somebody editing the workflow later.

**Non-Goals:**

- **Publishing every release.** The owner said it in as many words: not
  everything should reach the Marketplace.
- **Publishing the standalone server or the web UI.** They are not
  Marketplace artifacts; nothing about them changes.
- **Open VSX.** A second registry is a second decision, with its own
  token and its own audience. It can be argued for separately.
- **Unpublishing.** `vsce unpublish` exists and this workflow will not
  wrap it: a version pulled from the Marketplace stays gone and its
  number can never be reused, which is not a button to put beside a
  publish.

## Decisions

### A workflow of its own, on `workflow_dispatch` alone

`.github/workflows/publish-marketplace.yml`, with `on: workflow_dispatch`
and nothing else. A separate file rather than a job in `quality.yml`
because every job there is gated on an event, and a reader of that file
reasons about what a push and a pull request do. A job that runs on
neither, holding the one secret that can reach every installed copy,
belongs where it cannot be confused with them.

**Rejected: a job in `quality.yml` gated on the tag it creates.** That is
the automatic publish the owner asked not to have, dressed as a
condition.

**Rejected: publishing from a laptop with `vsce publish`.** It works, and
it leaves the token on a laptop and no record of who published what. The
run log is the record.

### What is published is the artifact that was released

The job takes a version, resolves the tag `openspec-ui-vscode@<version>`,
downloads the `.vsix` asset from that tag's GitHub Release and publishes
that file with `vsce publish --packagePath`. It does not check out `main`
and rebuild.

That is the difference between "the version we released" and "whatever
the tree holds now, called by that version's name". The released file is
the one `extension-integration` exercised, and rebuilding it could differ
by a dependency resolved a week later.

The job fails, before touching the Marketplace, where the tag has no
release or the release has no `.vsix`.

**Rejected: `vsce publish <version>`, which bumps and packages on the
spot.** It writes a version into `package.json` from outside the changeset
flow, and publishes a build nothing has run.

### A typed confirmation, and an environment

The dispatch takes two inputs: the version, and a field that must read
`publish`. The job's first step refuses anything else. A `workflow_dispatch`
is two clicks from the Actions tab, and one of them is a green button.

The job declares `environment: marketplace`. With no protection rules it
changes nothing; it is there so the owner can add a required reviewer, or
scope the secret to that environment, without editing the workflow. The
same field is where a deployment record appears, so what was published and
when is visible outside the run log.

### The secret is `VSCE_PAT`, read by one job

A repository secret, named as `@vscode/vsce` names its environment
variable, so nothing has to translate. `permissions` is `contents: read`
for the run, which is what downloading a release asset needs; nothing here
writes to the repository.

A token that reaches the Marketplace is worth rotating on a schedule the
owner keeps, and worth rotating at once if it is ever pasted somewhere
that keeps a copy. This design does not store it anywhere else, and the
workflow never echoes it.

### A check, because the guarantees are in YAML

`scripts/check-publish-workflow.mjs`, run by `npm run lint`, reads the
workflow and fails where it stops being what this change decided: an `on:`
with anything but `workflow_dispatch`, a missing confirmation input, a job
that does not verify the version against the tag, a secret read by more
than the publishing job, or a `vsce publish` that rebuilds instead of
taking `--packagePath`.

Every other guarantee in this repository is a test. This one is a file no
test reads, and the failure mode - a publish that goes out on a push
because somebody added a trigger while debugging - is exactly the one the
owner asked to prevent.

## Risks / Trade-offs

- **A publish still cannot be undone.** The confirmation and the
  environment make it deliberate; nothing makes it reversible. Stated
  here rather than implied by the two gates.
- **The token is one secret away from every installed copy.** It is
  readable by one job in one workflow, and the run log shows who
  dispatched it. Rotation is the owner's, and the design names it.
- **The version must already be released.** Publishing a build that has
  no tag is impossible by construction, which costs a wait for the
  release path on a version the owner wants out at once.
- **A check that reads YAML is a check that can be argued with.** It
  asserts the shape this change decided on, so a later change that wants
  a different shape must change the check with it - which is the point,
  but it is a cost.
