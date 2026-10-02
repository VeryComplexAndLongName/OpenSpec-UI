---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"@openspec-ui/cli": minor
"openspec-ui-vscode": minor
---

The local LLM agent is built in. `local-llm-acp` no longer starts an
external `coding-agent` that you had to find and install: it is a coding
agent inside the product, against your OpenAI-compatible server, with
tools to read, write, replace in a file, list, search and run a command,
all confined to the change's working directory. Each tool call and its
result shows in the run. It reads a tool call the model wrote as text
when the server's parser did not recognise it, as SGLang's `hermes`
parser does with Qwen3.6. Turn on
`openspec-ui.localLlm.agent.askBeforeCommands`
(`OPENSPEC_UI_LOCAL_LLM_ASK_BEFORE_COMMANDS=1`) to allow each command
yourself.

The model is optional for `local-llm` and `local-llm-acp`: a stage may
name one, the settings may, and otherwise the server is asked which model
it serves. A model id may now contain `/`, as Hugging Face names are
written.

Agents can ignore the system proxy: `openspec-ui.agents.ignoreSystemProxy`
(`OPENSPEC_UI_IGNORE_SYSTEM_PROXY=1`). The local LLM agents then connect
directly, and CLI agents start without the proxy variables and with
`NO_PROXY=*`.
