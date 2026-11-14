---
title: Which commit did those checks actually verify?
published: false
description: OpenSpec Workbench 0.108.0 puts the committed diff, the PR target, and recorded verification in one review.
tags: openspec, devtools, git, opensource
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/a-release-from-review-to-history/cover.png
canonical_url: https://openspec-ui.dev/articles/a-release-from-review-to-history/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/a-release-from-review-to-history/).*

Imagine a pull request that targets a release branch. You ran the tests yesterday, committed a fix this morning, and still have one edit in your editor. To review the PR, you need a diff against the release branch and a way to tell which commit those tests covered.

In OpenSpec Workbench 0.108.0, open **PR Review** on the change's Pipeline card. It compares committed work with the merge base of the PR target and flags the local edits left outside that comparison. Workbench can use the default branch for a labelled preview while the PR target is unknown.

Recorded mechanical checks show whether their revision matches the head in the review. Earlier results are marked as historical, and records without a revision are marked as unknown. The verify agent's outcome has its own entry. **Copy PR summary** carries the comparison and those qualifications into the PR as Markdown.

This release also adds **Send Feedback**, which opens a GitHub issue draft, and a diagnostic preview you can copy after a failed run. In VS Code, **Diagnose Workspace** shows prerequisites and steps to fix them before a run.

The same distinction between an event and a record of it matters after release. Our [release calendar](https://openspec-ui.dev/releases/2026/11/) can show individual versions by date because the source records contain release dates or commits. GitHub's asset download counter is a running total. When a day has no stored observation, the next reading tells us how much the counter moved over the interval.

[Install Workbench 0.108.0 from the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=openspec-ui.openspec-ui-vscode).
