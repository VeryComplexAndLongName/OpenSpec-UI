---
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Show the run dialog in the panel instead of a quick-pick.

`Run` in VS Code asked its question through a control that gives one line
per item and cuts the rest without saying so — every named
configuration's intent ended mid-word. It now renders the same dialog the
standalone shell renders, from the same components, in the panel that
already hosts them.

The plan travels in the first render's context, because it decides which
component mounts. Choosing a chain or a single stage mounts it in place;
the two answers only the extension can carry out — opening a chat
session, and writing a named configuration — come back as one message,
and the configuration's id rather than its contents, so a message cannot
decide what is written to a file. After a write the host re-reads and
posts the plan the file now resolves to.

The quick-pick is deleted rather than kept as a fallback: two dialogs
that must agree is the shape this removes.
