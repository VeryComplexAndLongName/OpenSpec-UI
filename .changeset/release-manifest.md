---
"@openspec-ui/cli": minor
---

Add a `release-manifest` command that builds the `releases.json` the homepage reads.

`OpenSpec-Ui-Homepage` currently reconstructs release information by walking this repository through the GitHub API, using a hard-coded map of `packages/<name>` paths that its own source calls "a bridge, not a destination" and that breaks silently on a monorepo reshuffle. The contract for the replacement already exists over there, in `app/schemas/manifest.py`; what was missing was a producer.

`openspec-ui-cli release-manifest` builds that document from this repository's own records: each product's version from its `package.json`, its notes from the matching section of its `CHANGELOG.md`, and the extension's VSIX from the GitHub Release that already exists. Notes are trusted only when the changelog describes the version actually shipping, a changelog that does not parse yields no notes rather than a guess, and a product whose `package.json` cannot be read fails the build rather than being quietly omitted.

`--fingerprint` prints the `id@version` set so CI can publish only when a version actually changed, and `--from` reads an already-published manifest so both sides of that comparison come from the same code.
