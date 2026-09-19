## Why

The owner has a Visual Studio Marketplace token and asked for publishing
to be part of the process - as a manual step, in their words, because not
everything should reach the Marketplace.

Nothing publishes there today. `release-extension` in
`.github/workflows/quality.yml` tags the commit and attaches the VSIX to a
GitHub Release, and that is where the story ends: a person who wants the
extension from the Marketplace gets whatever was uploaded there by hand,
whenever it was. Two documents say otherwise -
`.changeset/README.md` says the extension "still ships via `vsce`/the VS
Code Marketplace", and `README.md` names the Release page as the permanent
place to download a build without saying that the Marketplace is not fed
from here at all. A reader of either would be wrong about what a merge to
`main` does.

The version bump is automatic and the release is automatic, and both
should stay that way: they cost nothing to get wrong, because a GitHub
Release nobody downloads is a file nobody downloads. A Marketplace
publish is different. It reaches every installed copy through the
editor's auto-update, it cannot be taken back - a version pulled from the
Marketplace stays gone, and the number can never be reused - and the
owner wants some releases never to go there at all.

## What Changes

- **A publish is asked for, never inferred.** A new workflow, dispatched
  by hand from the Actions tab, publishes one named version. No push, no
  tag and no schedule can start it.
- **What is published is what was released.** The workflow takes the
  version, finds the `openspec-ui-vscode@<version>` tag's GitHub Release,
  downloads the `.vsix` that was attached to it, and publishes that file.
  Nothing is rebuilt, so what reaches the Marketplace is the artifact the
  integration suite exercised and the release page offers.
- **The press is deliberate.** The dispatch asks for the version and for
  the word `publish` typed into a second field, and refuses anything else.
  A workflow one click from the Actions tab needs a second hand on it.
- **The token lives in one place.** A repository secret, `VSCE_PAT`, read
  by that job alone and by nothing else, with the job bound to a GitHub
  environment so a required reviewer can be added later without touching
  the workflow.
- **The documents stop claiming what does not happen.** `.changeset/
  README.md` and `README.md` say what the automatic path does - tag and
  Release - and that the Marketplace is a separate, asked-for step.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-quality`: the repository can publish a released version to the
  Marketplace, and does so only when a person asks for that version by
  name.

## Impact

- **`.github/workflows/publish-marketplace.yml`**: new, `workflow_dispatch`
  only.
- **`.github/workflows/quality.yml`**: untouched. The automatic path keeps
  tagging and releasing exactly as it does now; this adds a second path
  rather than changing the first.
- **`README.md` and `.changeset/README.md`**: corrected where they describe
  what ships and how.
- **`scripts/check-publish-workflow.mjs`**: new, run by `npm run lint` -
  the guarantees that make this safe (dispatch only, a typed confirmation,
  the version checked against the tag, one job reading the secret) are
  guarantees in a YAML file, which nothing else in this repository would
  notice the loss of.
