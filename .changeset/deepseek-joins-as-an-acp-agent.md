---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

DeepSeek is an agent

`deepseek-cli-acp` runs DeepSeek through its CLI's ACP profile,
`dsh --profile acp`, and can be picked for any stage or task like the
other agents. Its prompts start with a short instruction to follow the
steps literally and in order. It uses DeepSeek-V4-Flash, `dsh`'s default,
and reports no usage.

`dsh` needs a Node newer than 22.11 on the PATH it is started with. On
22.11 it exits without a word, and the run now says which Node it found.
