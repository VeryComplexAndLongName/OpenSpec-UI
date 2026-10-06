---
"openspec-ui-vscode": patch
"@openspec-ui/core": patch
"@openspec-ui/webui": patch
---

The Agentic Harness setup, the AI panel and the repository-setup facts look for the local LLM where `openspec-ui.localLlm.baseUrl`, the stored key and `openspec-ui.agents.ignoreSystemProxy` say, instead of only at the environment's address or `localhost:30000` (the-local-model-is-offered-where-it-is-set). The setup offers `local-llm-acp` even where its server does not answer yet, marked so in the list, puts its control agent on propose, review and verify (it named archive, which refuses an agent), and no longer offers `local-llm`, which edits no file; Harness Settings and the run dialog now say when `local-llm` is on a stage whose work is files.
