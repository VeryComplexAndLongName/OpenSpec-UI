---
"openspec-ui-vscode": patch
---

A running chain's row in the Processes tree offers Cancel Process again, and a Pipeline card's Continue and permission answers reach a chain in the editor. The editor had sent them through the chain runner's agent runner, which answers neither, so pressing Continue did nothing; they now go to the chain runner itself, as the standalone server's socket does. The command is titled "OpenSpec UI: Cancel Process", no longer "Cancel Implementation Session", since a chain's row offers it too.
