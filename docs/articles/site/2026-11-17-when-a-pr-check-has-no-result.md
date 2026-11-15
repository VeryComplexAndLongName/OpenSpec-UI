---
title: When a PR check has no result
summary: OpenSpec Workbench 0.109.0 shows GitHub check results for the published PR commit, links them to OpenSpec scenarios and previews changes to the specs before archiving.
cover: cover.png
cover_alt: Green and amber indicators sit beside an empty socket on a graphite diagnostic panel.
---

On the OpenSpec Workbench release PR, we were waiting for a required GitHub check that had produced no result. Running our local verification again would have answered a different question. We needed to see what GitHub knew about the published commit and what the target branch expected. [Release PR #964](https://github.com/VeryComplexAndLongName/OpenSpec-UI/pull/964)

## Read the published commit

In OpenSpec Workbench 0.109.0, open **PR Review** from a change's Pipeline card and select **Refresh GitHub checks**. The report names the PR, its target branch and the commit published on GitHub. It lists the states that GitHub reported and links to available GitHub run pages. If your checkout has a newer commit, the report identifies the published commit separately from its local comparison.

Below the results, the review lists the checks in the target branch rules that it could read. If a required check has no result for the published commit, the report says so. If permissions or an incomplete response prevent Workbench from checking that, the report says that too. For a required check tied to a particular GitHub App, a matching name alone is insufficient. **Copy PR summary** carries the same distinctions into the pull request.

## See which scenarios a check covers

A passing integration check can exercise many paths. The reviewer still has to decide which scenarios it supports. PR Review now lists scenarios in the added and modified requirements of the reviewed commit. Commit a `scenario-checks.json` next to your proposal to link a scenario to named GitHub checks. After refresh, the view shows the check's result when GitHub reported it for that same commit. [Mapping file example](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/how-to/link-scenarios-to-checks.md)

For example, you can associate “A customer pastes a postal code with extra spaces” with the checkout integration check. The adjacent empty-postal-code scenario can stay visible as unlinked until the team has a check for it. The association records the team's intent. A check's reported result is evidence about the named run and revision.

## Inspect the spec before archive

Select **Show Archive Preview** to see how OpenSpec would apply the change's committed delta to the locally known default branch. Workbench runs the preview in a disposable directory and displays the predicted spec diff or the CLI's refusal. It also names requirements that changed in the default branch since the common ancestor or are named by another local change branch.

If a second checkout change touches the shipping-address requirement, you can see that overlap while both changes are still under review. If OpenSpec refuses to apply the delta, its reason is available before the actual archive.

## Try it before opening a project

**Open Example** opens a fictional checkout review in the standalone workspace or from the VS Code command palette. It includes a proposal, tasks, a committed diff, a missing GitHub result and a scenario with no associated check. You can read it and copy the sample summary without configuring an agent or changing files.

OpenSpec Workbench 0.109.0 is available in the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=openspec-ui.openspec-ui-vscode).
