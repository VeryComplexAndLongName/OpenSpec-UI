---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/extension": minor
---

Name the four configurations by the effort they ask for.

They were named by their ceilings, with the figures in the title. A title
reading "up to $3" was read as what a run would cost, and it is not a
price — it is the point at which a run is stopped.

Thorough, Careful, Balanced and Economy each carry an effort *level*
rather than a value, resolved when the configuration is applied against
the agent that stage will use: "highest" is `max` for `claude-cli` and
`high` for `codex-cli`, and nothing at all for the five registered agents
that accept no effort, where both surfaces say the configurations differ
in their ceilings alone. None of them sets a model — the model is
whichever the workspace already configured, and each says so in its own
text. The ceilings are unchanged and still carry where each figure came
from.

Applying one now goes through one function in `core` for both hosts, so
the change's existing `harness.json` is kept and the stage's agent is
written beside the resolved effort.
