---
"@openspec-ui/core": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

A finished working directory is removed even when it holds long paths or a downloaded VS Code

The editor's sweep no longer leaves a finished working directory on disk
when it holds a downloaded VS Code, as the extension's integration tests
leave in `.vscode-test`. Git now removes paths longer than 260 characters
on Windows. Inside the editor, the rest of the removal no longer opens the
downloaded editor's `node_modules.asar` as an archive, which had failed
and kept the file locked until the editor closed. When a removal still
fails, the message now names what stopped it, not only git's complaint.
