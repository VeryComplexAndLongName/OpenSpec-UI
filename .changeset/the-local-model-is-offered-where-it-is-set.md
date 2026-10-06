---
"openspec-ui-vscode": patch
---

The Agentic Harness setup, the AI panel and the repository-setup facts look for the local LLM where `openspec-ui.localLlm.baseUrl`, the stored key and `openspec-ui.agents.ignoreSystemProxy` say, instead of only at the environment's address or `localhost:30000` (the-local-model-is-offered-where-it-is-set). The setup offers `local-llm` and `local-llm-acp` even where their server does not answer yet, marked so in the list.
