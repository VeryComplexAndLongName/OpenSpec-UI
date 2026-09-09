---
"@openspec-ui/core": patch
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
---

Choose a custom agent where the stage's agent is chosen.

`POST /api/custom-agents` returns the definitions a workspace holds, with
the directories they were looked for in, and the harness settings offer
one picker per stage — listing only the definitions that stage's own CLI
accepts.

Nothing is offered as an empty control: a stage whose agent takes none
says so, a workspace defining none says so and names the directories
read, and a configured name the discovery no longer finds stays selected
and is marked as not found rather than being replaced.

Saving a stage now keeps a `model` this form has no control for. It was
being deleted on save — the same defect as `settings-save-what-was-shown`,
one level down in the stage entry.
