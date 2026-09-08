---
"@openspec-ui/core": patch
---

A run stopped by a ceiling now records why in the audit log. The reason
travels on the cancel command, so a run cut by a rule can be told from
one a person cancelled without inspecting anything else. A person's
cancel still records no reason.
