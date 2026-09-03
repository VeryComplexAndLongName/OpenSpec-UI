---
"@openspec-ui/core": minor
"@openspec-ui/webui": patch
---

`stepAgents` no longer accepts a `git` entry, joining `archive` — the
`git` stage runs its own push/pull-request/merge sequence and invokes no
CLI agent, so there was never anything for a `stepAgents.git` entry to
configure. `HarnessStepAgentStage` now excludes both stages; a
`stepAgents.git` entry from before this restriction existed is read and
dropped with a warning naming the file, not rejected.

The standalone settings surface (`HarnessSettingsView.tsx`) now renders
`git` the same way it already renders `archive`: listed, with no agent,
effort or budget picker. Previously it offered a picker for an agent id
that `HarnessChainRunner` never read.
