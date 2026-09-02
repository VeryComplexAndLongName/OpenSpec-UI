---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Implement harness config strictness for stage runner selection and validation.

- Replace legacy `dispatch` usage in `stepAgents` with a dedicated `vscode-chat` step-runner id.
- Refuse `model`, `effort`, and `budget` on chat-dispatched stages because those values cannot reach any CLI invocation.
- Reject unknown keys in `stepAgents` entries and nested `budget` objects.
- Migrate legacy `dispatch: "vscode-chat"` / `dispatch: "cli"` shapes on read and write.
- Update core, webui, extension, and server runtime/test coverage for the new strict behavior.
