---
"@openspec-ui/core": minor
---

Agentic Harness `stepAgents` entries may now name a model alongside the agent (`{ agent, model }`, in addition to the existing bare agent id string), passed as `--model <value>` to `claude-cli`/`copilot-cli`. Lets a change configure a cheap model for `apply` and an expensive one for `propose`/`review`/`archive` on the same CLI. A model is validated against a closed character set and against the target agent's registry entry at config-read time, before any run starts.
