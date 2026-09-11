---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
---

Repository Setup offers only the actions that can do something.

Configure Dependabot appears where the origin is github.com; the
path-scoped Copilot instructions appear where Copilot is present, by its
editor extension or a `copilot` binary on the path. Generate Agent
Instructions stays unconditional — plain files any agent may read.

The two are decided differently on purpose: Dependabot is a service the
repository's host runs and nothing is installed for it, while Copilot is
a component on the machine.

An action that is not listed stays in the Command Palette, where
invoking it says what was established and offers to proceed — the only
correct answer to a GitHub Enterprise host, which no URL check can
recognise. A check that could not be completed shows the action rather
than hiding it.

`GitWrapper` gains `remoteUrl`.
