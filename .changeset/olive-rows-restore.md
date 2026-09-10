---
"openspec-ui-vscode": patch
---

A change row rebuilt to answer "what is this element's parent" now
carries the state the tree drew, instead of `draft` written in. VS Code
restores the tree's selection through that chain after a window reload
and draws what it returns, so a change with every task done could read
`draft` until the next refresh.
