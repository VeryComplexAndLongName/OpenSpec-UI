---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

**Every message has an identifier** (every-message-has-an-identifier, ADR 0046). Core gains one register of what the product says to a person: each message's identifier `OSW-<GROUP>-<NNN>`, its level, its words, why it is said and what to do, and [docs/messages.md](../docs/messages.md) is generated from it. The first groups are in it: the CLI's argument errors (`CLI`), the chain's refusals, limits and endings (`RUN`), the operator's questions (`QST`) and the permission requests nobody can answer (`PRM`). Their words are unchanged; the CLI now prints them as `error OSW-CLI-003: --cwd requires a value` rather than `openspec-ui-cli: --cwd requires a value`, with the same exit codes. `progress`, `failed` and `cancelled` events carry `code` beside their words, and so does the CLI's JSON; the CLI, the output channel and the panels put the identifier before the words (`✗ OSW-RUN-104: "apply" changed no file ...`), and the panels show it as a link to its entry. A test counts the messages still said in place - 290, from 323 - and lets the number only fall.
