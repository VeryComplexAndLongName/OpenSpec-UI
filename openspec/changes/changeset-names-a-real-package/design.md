# Design

## Decision: check the names, not the release

`changeset version` already refuses an unknown package. What is missing
is that it only runs where a pull request cannot see it. Reading the same
names out of `.changeset/*.md` and comparing them to the workspace costs
one file read per changeset and answers the same question, in `npm run
lint`, where every change already passes.

## Decision: the workspace list is read, not written down

The known names come from the root `package.json`'s `workspaces` globs
and each package's own `name`. A list in the script would be a second
place to forget a package, which is the same class of mistake as the one
being fixed.

## Decision: the frontmatter is read with a regular expression

A changeset's frontmatter is a list of `"name": bump` lines. Taking a
YAML parser as a dependency to read that would be a larger risk than the
one it removes, and this repository has made the same call before for
the `description` line of a custom agent's frontmatter.
