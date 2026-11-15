## Why

PR Review shows the whole branch after every push. A reviewer who has already read it needs the exact edits between that review and the current committed head.

## What Changes

Add Mark as reviewed and Changes since last review to PR Review in both hosts. The mark records the displayed commit locally. The comparison shows proposal, scenario and implementation edits since that commit and labels the revisions.

## Capabilities

### Modified Capabilities

- `pr-review` gains the behavior described above.

## Changelog

### VS Code extension and standalone app

- PR Review can remember the commit you reviewed. Use **Changes since last review** after a push to compare the new proposal, specification and code edits with that commit.
