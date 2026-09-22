---
title: One interface, three forges
published: false
description: GitHub, GitLab or Gitea now sit behind one Forge interface. What that took, and the quirks live testing found on each of the three.
tags: openspec, git, gitlab, gitea
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/one-interface-three-forges/cover.jpg
canonical_url: https://openspec-ui.dev/articles/one-interface-three-forges/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/one-interface-three-forges/).*

Until this week, OpenSpec Workbench knew one way to open a pull request,
check it, and merge it: `gh`, GitHub's own CLI. If your repository lived on
GitLab or Gitea, or if `gh` simply was not installed, the archive stage said
so and stopped. That is fixed now, on all three, and the way it got fixed is
the more interesting part.

![Your repository's origin decides which forge answers: GitHub, GitLab or another host probed for Gitea, all behind one Forge interface](https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/one-interface-three-forges/diagram.png)

## The interface, not the tool

The fix is not "support GitLab too" bolted onto the GitHub path. It is one
`Forge` interface - list a pull request by branch, open one, ask for a merge,
read its checks - that the `git` stage and the archive pass call without
knowing which host answers. Three implementations sit behind it: GitHub's
own REST and GraphQL, GitLab's REST API, and Gitea's. Which one runs is
decided once, by reading the repository's own `origin`: github.com is
GitHub, gitlab.com is GitLab, and anything else is probed - Gitea's
`/api/v1/version` first, then GitLab's `/api/v4/version` - so a self-hosted
instance is found without being told what it is.

## The token decides the way, even for GitHub

GitHub is the one host that had two paths from the start: `gh`, or now its
own API when `GITHUB_TOKEN` or `GH_TOKEN` (the same variable `gh` itself
reads) is set in the environment. Without one, the product goes through
`gh` exactly as before - this did not become a breaking change for anyone
already running it. Where neither a token nor `gh` is available, the
reading says so plainly: "gh is not installed, and GITHUB_TOKEN is not
set", rather than failing on a command that was never going to work.

## What running it against real hosts found

Reading a REST API's documentation and calling it in anger are two
different exercises, and this is where the honest part of the story is.

**Gitea** was tested live on 1.26.4, in a throwaway repository deleted
after each run. Two behaviours needed handling that no amount of reading
would have surfaced: a repository with a single branch answers a pull
request listing with 404 rather than an empty list, and a merged pull
request's head can report a label naming a branch that no longer exists.
Handled once, both stay handled everywhere Gitea is the forge.

**GitLab** was tested live on gitlab.com, in a throwaway private project.
The first token given for it was fine-grained without quite enough scope,
and GitLab said so plainly (`insufficient_granular_scope`) rather than
failing silently. Once a token with the right scope was in place, the
first merge attempt was refused with a 422, "Branch cannot be merged" -
not because it could not be merged, but because GitLab had not yet finished
deciding whether it could. The forge now waits and asks again before
believing a 422. On both hosts, once that was in place, the full path ran
end to end with the real archive command: it found the finished change,
opened a pull request, watched it merge by itself, and the repository held
the archived change afterward, spec applied.

**GitHub's own API** was tested live too, on 2026-09-22, with `gh`'s own
token handed to the process as `GITHUB_TOKEN` and `gh` itself kept off the
`PATH` - so there was no fallback to quietly catch a mistake. Against this
repository it read 147 pull requests and a real check run as a pass,
read-only. Against a fresh throwaway repository, the first automatic merge
was refused outright: "Auto merge is not allowed for this repository",
GitHub's own setting on a brand-new repo. The archive pass left the pull
request open and said why, exactly as the project's own rule requires
rather than pretending the merge had happened. Turning the setting on let
the same request merge by squash. A second pull request, opened to test
what the `git` stage's own gateway does with no checks configured at all,
correctly read "no check result was available" and declined to merge -
absence of information is not the same as a green light.

## What this does not cover

**GitHub Enterprise Server** is not detected as its own case. A host that
answers neither Gitea's nor GitLab's version probe is assumed to be GitHub
and handled through `gh`, which already knows how to reach a GitHub host of
its own. **The allowlist that gates what the `git` stage may push, create or
merge** still speaks in `gh`'s own terms - the remote and the branches it
names - regardless of which forge actually does the work underneath.

## Try it

The code is at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
where the repository and packages keep the name OpenSpec-UI. The core this
rests on is described in
[One core, two hosts](https://openspec-ui.dev/articles/one-core-two-hosts/).

## Where each claim comes from

- The `Forge` interface, the three implementations and how one is chosen:
  the archived changes
  [`the-forge-is-gitlab-or-gitea-too`](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/openspec/changes/archive/2026-09-22-the-forge-is-gitlab-or-gitea-too/proposal.md)
  and
  [`github-without-gh`](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/openspec/changes/archive/2026-09-22-github-without-gh/proposal.md).
- The Gitea and GitLab live findings (the 404, the stale branch label, the
  scope error, the 422-until-decided): `the-forge-is-gitlab-or-gitea-too`'s
  own `tasks.md`, task 3.2 and 3.3.
- The GitHub API live findings (the 147 pull requests, the refused
  automatic merge, the "no check result" case): `github-without-gh`'s own
  `tasks.md`, task 4.2.
- Which forge, which token, and the exact reading when neither a token nor
  `gh` is available: [HARNESS.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/HARNESS.md).
- What this does not cover: `github-without-gh`'s proposal, "Explicitly out
  of scope".
