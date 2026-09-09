---
"@openspec-ui/core": minor
---

`buildWorkspaceRunStats` reads the audit log back as an aggregate over
the workspace: per agent, and per agent and effort together. Each group
carries how many runs it rests on and how many of those reported a cost,
and a group below the threshold of five is reported as below it rather
than omitted — "too little is known here" and "this has never run" are
different facts.

Runs recorded against a change that is neither active nor archived are
excluded. Such a change was deleted, which makes it an experiment rather
than part of the project's record; without this, a project's own smoke
tests count as its behaviour.
