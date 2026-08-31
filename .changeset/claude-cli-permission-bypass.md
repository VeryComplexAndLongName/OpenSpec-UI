---
"@openspec-ui/core": patch
---

Fix `claude-cli` runs stalling on an unanswerable Edit/Write/Bash permission prompt in non-interactive mode. `buildInvocation()` now passes `--dangerously-skip-permissions`, matching the existing non-interactive-bypass posture already used by `copilot-cli` (`--allow-all-tools`) and `gemini-cli` (`--yolo`).
