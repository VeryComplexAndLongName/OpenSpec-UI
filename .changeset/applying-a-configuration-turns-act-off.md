---
"@openspec-ui/core": patch
"@openspec-ui/webui": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

Applying a named configuration to a change under the supervisor's Act no longer fails (applying-a-configuration-turns-act-off). Every named configuration sets Semi-autonomous, and Act acts only under Autonomous, so applying one - or saving a change's Harness Settings with another autonomy level - turns Act off instead of refusing the write, keeps the fallback agents and allowances, and says so where it says what was applied or saved. A file written by hand that sets both Act and another level is not run, but it now opens in the change's Harness Settings, which put it right on Save.
