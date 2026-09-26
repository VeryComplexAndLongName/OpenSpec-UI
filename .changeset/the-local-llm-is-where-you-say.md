---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
---

The local LLM (agent `local-llm`) can be told where it is, which model to
ask for, and its API key. In VS Code: the settings
`openspec-ui.localLlm.baseUrl` and `openspec-ui.localLlm.model`, and the
command **Set Local LLM API Key...**, which keeps the key in the editor's
secret storage. In the standalone server and the CLI:
`OPENSPEC_UI_LOCAL_LLM_BASE_URL`, `OPENSPEC_UI_LOCAL_LLM_MODEL` and
`OPENSPEC_UI_LOCAL_LLM_API_KEY`. The key is sent as a bearer token and
written nowhere. A base URL is accepted with its `/v1` or without it.
