---
title: When a PR check has no result
published: false
description: OpenSpec Workbench shows the GitHub check results for your published commit and the checks your target branch expects.
tags: openspec, devtools, github, opensource
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/when-a-pr-check-has-no-result/cover.png
canonical_url: https://openspec-ui.dev/articles/when-a-pr-check-has-no-result/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/when-a-pr-check-has-no-result/).*

A release PR is waiting for CI. A developer has a passing local test run, but GitHub is expecting a result for the published head. The useful question is which check has reported on that commit.

In OpenSpec Workbench 0.109.0, open **PR Review** and select **Refresh GitHub checks**. You can see the published commit, the checks GitHub reported, and links to their available runs. The report also lists required checks it can read from the target branch and calls out a missing result or an incomplete reading. **Copy PR summary** brings those details into the PR.

A committed `scenario-checks.json` associates an OpenSpec scenario with named GitHub checks. For example, a checkout integration run can support a scenario for trimming a pasted postal code. A scenario with no associated check stays visible. [Mapping file example](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/how-to/link-scenarios-to-checks.md)

Use **Show Archive Preview** to see the predicted specification diff against the locally known default branch and which requirements overlap with other local changes. **Open Example** lets you try the review and copy its sample summary from the standalone workspace or VS Code command palette.

[Get Workbench in the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=openspec-ui.openspec-ui-vscode).
