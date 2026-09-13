---
"@openspec-ui/core": minor
"@openspec-ui/webui": patch
"openspec-ui-vscode": patch
---

A delegated run says what happened.

Handing a task to an agent through the delegated-item route could fail without saying why, and could not be seen while it ran. A marker that named its agent in backticks — ``**Delegated to `claude-cli`**``, the way every delegated item had been written — named no agent at all; it now names the same agent as the bare id, while a backtick on one side only still names nothing. A run that stopped reported only the agent's exit code; its result now carries the last lines the agent wrote to stderr, bounded, and its message quotes the last of them ("claude exited with code 1. It last said: …"). The standalone inbox shows the whole tail in a disclosure beneath the row's outcome, and VS Code shows a stopped run as a warning with a "Show output" action that writes the tail to the OpenSpec UI output channel. And a delegated run now keeps the same status record as any other run, so `openspec-ui-cli status`, the survey and the Pipeline tab see it, whichever host started it.
