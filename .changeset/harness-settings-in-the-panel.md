---
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Edit the harness configuration in VS Code through the settings view.

Both `Configure Harness` commands opened the JSON file, which carries
none of what the surface knows: which effort values the chosen agent
accepts, which spending field it honours, which custom agents the
workspace defines, and which configured ceilings cannot act. They now
open the same settings view the standalone shell renders, in the panel,
with the per-change command loading that change's override.

The files stay hand-editable and the view names them.

This needed the webview to be able to ask its host a question: the bridge
carried a command one way and events the other, and neither shape is a
read. Requests name one of five operations — never a path, a file or a
function — and the host answers against its own workspace root, carrying
a refusal back as the error rather than swallowing it.
