---
"openspec-ui-vscode": patch
---

Adds "OpenSpec UI: Set Up Agentic Harness", a re-runnable guided first-run flow for the global `openspec/agent-harness.json`: it detects available CLI agents and asks for a control agent (`propose`/`review`/`archive`), an apply agent (`apply`), and an autonomy level (`assisted`/`semi-autonomous` only), writing each answer to disk as soon as it is given so cancelling mid-flow never loses an earlier answer. Successfully running "OpenSpec UI: Initialize Workspace" now offers a dismissible suggestion to run this flow when no global harness config exists yet. Choosing `claude-cli` for either role also checks the already-detected CLI version against the version this project's `claude-cli` ACP translation layer was last verified against, showing a dismissible warning (not a block) on a mismatch.
