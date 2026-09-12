---
"@openspec-ui/core": minor
"@openspec-ui/cli": patch
"@openspec-ui/webui": patch
"openspec-ui-vscode": patch
---

A running agent now says what it is doing: which file it reads or edits, which command it runs, and which call failed.

While `claude-cli-acp` worked, the AI panel repeated `agent update: assistant` and the terminal printed nothing but the agent's final words. The adapter forwarded Claude's own stream under ACP's name, so nothing downstream could read it, and no surface showed a tool call or a plan from any agent. The adapter now translates Claude's stream into ACP's own session updates — the agent's text, each tool call titled by what it acts on (`Edit packages/core/src/index.ts`, `Bash: npm test`), and each result as completed or failed. Core gains `describeAcpUpdate`, which reads an ACP update into one line and knows no particular agent; the AI panel, the VS Code output channel and the terminal all show that line.
