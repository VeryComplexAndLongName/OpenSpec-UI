---
"@openspec-ui/cli": minor
"@openspec-ui/core": patch
---

Launch the standalone Workbench with `npx @openspec-ui/cli open workbench --cwd <project>` without cloning or building OpenSpec-UI. The command prints an authenticated localhost URL, accepts `--port` and stops on Ctrl+C. OpenSpec and agent executables remain separate prerequisites for operations that use them.
