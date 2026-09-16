---
"@openspec-ui/webui": minor
"openspec-ui-vscode": patch
---

The standalone shell wears the project site's frame (ADR 0033). A bar across
the top carries the owl, the name, the workspace and the theme switch; a page
head names the open tab under a tagline; the nine tabs fit one row with short
labels — Run, Processes, Diff, Summary, Editor, Templates, Timeline,
Pipeline, Harness — the current one underlined in red; the page is 1180
pixels wide, with a footer carrying the versions. The palette is the site's,
in light and dark, and the summary's tiles take its KPI shape and colours.
Each tab keeps its full name for assistive technology. In VS Code the
webviews keep the editor's colours and take no part of the frame.
