---
"@openspec-ui/core": patch
"@openspec-ui/webui": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

The Sprint Report opens again, and four times faster

In the standalone, the report's tab now opens at the click and says how
many changes it is reading, then becomes the report. It used to open only
once the report was ready, and a browser refuses a tab that late: after a
long wait at full load, nothing appeared.

The report now reads its changes the way the Timeline tab does, in
batches with the archive's dates read once. Every change's authorship and
every proposal's first commit now come from one git call each, where they
were asked once per change. Over this repository's 296 archived changes the
report takes 26 s instead of 109 s; a week's 66 changes take 7 s. The
Timeline tab's comparison reads the same dates the same way and gains too.
The editor's command shows a progress notification while it reads.
