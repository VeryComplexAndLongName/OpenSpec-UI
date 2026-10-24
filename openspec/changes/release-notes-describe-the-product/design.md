## Context

Changesets generates product changelogs; transitive dependency bumps carry
no feature copy. The manifest excludes that bookkeeping and marks Core
non-public. Therefore authors must name the products whose users receive
a shared feature, with copy for those products. Showing Core publicly or
copying every internal note would expose the wrong product boundary.

## Decisions

ADR 0054 keeps Changesets as the versioning source and adds concise release
copy to each new OpenSpec proposal's Changelog section. Use one to three
bullets, each one or two sentences, at most 80 words per changeset body.
Name the observable change, its scope, and any essential requirement or
limitation. No vague fixes, implementation diary, or dependency-only
placeholder. Different audiences may need separate changesets.

Make this reach agents through config context, proposal/task rules and
apply/archive guidance, with runbook pointers. The changeset linter can
enforce length and placeholders, but factual accuracy and product scope
remain review obligations rather than a word-count claim.

Correct released Codex entries in place without changing version headings,
original commit/dependency references, tags or artifacts. The current
product versions explicitly mention where Codex support first appeared;
the pending patch changeset carries a readable announcement into the next
generated product changelogs. Existing GitHub notes receive an authored
Highlights section before their original history, with a local backup and
a readback; assets and tags remain unchanged.

The existing changelog parser joins continuation lines and still drops
dependency bullets together with their nested lists. A small generator
uses the same parser for GitHub Highlights. The version PR checks that
each public product's current version has substantive notes; the release
job generates its file before tagging and prepends it to GitHub's history.
There is no fabricated fallback when a product has no authored notes.

Rejected: exposing Core as a public product; blindly copying all private
notes; truncating text mid-sentence; changing old version numbers; and
requiring a new upstream OpenSpec schema/artifact merely to write copy.

## Non-Goals

No agent execution changes, new event contract, automatic Marketplace/npm
publication, full local suite, website layout redesign, or schema change.

## Risks / Trade-offs

Editorial quality is not fully mechanical. The release guard deliberately
requires authored public-product copy, including an accurate maintenance
note for releases with no feature change. Correcting repository notes
does not replace old VSIX artifacts. The new version/manifest publication
will carry the announcement through the existing website pipeline.

## Verification

Run only the changeset/config test files and the CLI release-manifest
tests; exercise the real note generator and its version-check mode against
small fixtures. Check the changed workflow's note generation before tag
creation, actual OpenSpec proposal/tasks instructions, authored files, and
strict change validation. Full builds, suites and browser runs stay in CI.
