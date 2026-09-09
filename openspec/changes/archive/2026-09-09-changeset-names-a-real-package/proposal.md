# A changeset names a package this workspace has

## Why

`main` has been failing its release job since 2026-09-09, for three
merges, and no pull request could have caught it.

A changeset in #342 named `@openspec-ui/extension` — the directory the
extension lives in. The package is called `openspec-ui-vscode`.
`changeset version` refuses a name it cannot resolve:

```
Error: Found changeset configurations-named-by-effort for package
@openspec-ui/extension which is not in the workspace
```

The job that runs it is `Version pending changesets`, and it is skipped
on pull requests — it only has work to do once something is on `main`.
So the check that would have caught this ran for the first time after the
merge, and then again after the next two, failing identically each time.

Nothing shipped is broken by it. What stopped is the release: no version
pull request has been opened since #342, so no package version or
changelog has moved.

## Capabilities

### New

- A changeset naming a package the workspace does not have fails the
  ordinary lint, before the merge rather than after it.

## Out of scope

Making the release job run on pull requests. It exists to open a version
pull request against `main`, and running it earlier would either do
nothing or open one from a branch. The cheaper answer is to check the
files it reads.
