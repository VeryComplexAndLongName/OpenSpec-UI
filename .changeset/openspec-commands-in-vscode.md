---
"openspec-ui-vscode": minor
---

Run this repository's own `typecheck`/`test`/`lint` checks from the editor —
three new commands, shown in the Changes view title and Command Palette only
when the open workspace actually declares a script for them. Resolution
prefers an `openspec-ui.checks` setting, then an `osui-<name>` script (for a
workspace that wants to expose something faster or narrower to the editor
than its own), then the bare `<name>`; a workspace declaring neither is
offered no command rather than one that fails. Each run reports through the
same `runMechanicalCheck` the Agentic Harness's `verify` stage already uses,
so a failure states the command and its output. Also adds a Show Change
Comparison Timeline entry to the Changes view title menu.
