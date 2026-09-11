# Setup offers only what applies

## Why

Asked on 2026-09-10 and settled on 2026-09-11, translated because every
file here is English: "In Repository Setup there is Configure
Dependabot. Is it permanent? I mean, what if there is no Dependabot?
What if the repository is not GitHub?" — and then: show these items only
where the components they configure are present.

Repository Setup offers three actions and offers all three always.
Two of them are useless in most repositories:

**Configure Dependabot** writes `.github/dependabot.yml`. Dependabot is
a GitHub service. In a repository hosted anywhere else the file is inert
— it is read by nothing, and it is committed, so it also misleads the
next person into thinking dependency updates are configured.

**Generate Path-Scoped Copilot Instructions** writes
`.github/instructions/<subtype>.instructions.md`, which GitHub Copilot
reads. Where Copilot is not present, the command produces a file nothing
reads.

The two are not the same kind of thing, and treating them as one is the
mistake to avoid. Dependabot cannot be installed — there is nothing to
put on a machine; what decides it is where the repository is hosted.
Copilot genuinely is an installed component, and its presence is
detectable.

The third action, **Generate Agent Instructions**, stays unconditional.
`CLAUDE.md` and `AGENTS.md` are plain files that any agent may read, and
there is nothing whose absence would make them pointless.

## Capabilities

### Modified

- Repository Setup lists only the actions that can do something in this
  repository, on this machine.
- Whether Dependabot applies is decided from where the repository is
  hosted; whether the Copilot action applies is decided from whether
  Copilot is present.

### New

- An action hidden from the list is still reachable from the command
  palette, where invoking it explains why it does not apply here and
  offers to proceed anyway.

## Out of scope

The standalone shell. Repository Setup exists only in the VS Code
extension's tree; the shell has no such section, so there is nothing
there to filter.

Changing what any of the three actions writes. This changes when they
are offered, not what they do.

Detecting whether Dependabot is actually enabled for the repository on
GitHub. That needs an authenticated API call for a file the person may
be about to create; the question this answers is whether the file could
mean anything at all, which the remote settles on its own.
