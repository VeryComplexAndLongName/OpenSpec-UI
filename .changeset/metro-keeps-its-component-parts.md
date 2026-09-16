---
"@openspec-ui/webui": patch
"openspec-ui-vscode": patch
---

Metro now draws the parts of a panel and a timeline that the screens name. A
panel's title has its icon slot and its caption padding, so an icon no longer
touches the border, and a timeline has its time and text columns. The derived
Metro copy had dropped those rules, so the screens looked as they did before.
