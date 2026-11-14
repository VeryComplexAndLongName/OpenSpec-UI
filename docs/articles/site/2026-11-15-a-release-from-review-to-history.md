---
title: An OpenSpec release, from PR review to public history
summary: Review a change against its pull request target, see which checks match the commit, and find what shipped in the rebuilt release calendar.
cover: cover.png
cover_alt: Two glass panels on a dark desk show an abstract code diff and a timeline with gaps between observations.
---

A reviewer opening a pull request needs to know which branch it targets and whether the recorded checks ran on the commit under review. OpenSpec Workbench 0.108.0 brings both answers into **PR Review**. The project site now has a release calendar that answers a different question: when did a version actually ship?

## See what the PR brings into its target branch

Open **PR Review** from the change's Pipeline card. If the pull request targets a release branch, Workbench compares the change's committed head against the merge base with that release branch. Local edits stay out of the comparison, and the review calls them out. Before Workbench knows the PR target, it can show a comparison against the default branch, labelled as a preview.

The checks section shows recorded mechanical checks and the verify agent's outcome separately. A check on the commit you're reviewing appears with that revision. A result from an earlier commit is marked as historical. Older records without a commit are marked as unknown, and missing evidence has its own state. Opening the review reads the records already there.

Use **Copy PR summary** to take the base, head, changed-file summary and recorded check results into the pull request as Markdown. The copy keeps the qualifications shown in the review, so a check on an older commit cannot turn into an unqualified pass in the PR description.

## Share a failure on your terms

**Send Feedback** opens a GitHub issue draft. After a failed run, you can preview a short diagnostic report and decide whether to copy it into the issue. The report includes the available Workbench version, platform and failure category. Workspace contents and raw run output stay local. In the VS Code Workspace view, **Diagnose Workspace** shows which prerequisites need attention and how to fix them.

## Look up a release by date

The [release calendar](https://openspec-ui.dev/releases/2026/11/) now reaches back through the project's release records. It uses GitHub Releases for VS Code, the first appearance of each standalone version on the main branch, and npm publication dates for the CLI. When several versions land on the same day, the calendar keeps each version visible.

The Downloads dashboard has two kinds of history. The Marketplace publisher report gives daily web downloads and VS Code installs. Marketplace updates and GitHub release asset downloads are running totals. If the collector has a reading on Monday and the next on Friday, the difference belongs to that whole interval. A release date says when a version became available and gives no way to assign those downloads to particular days.

Workbench 0.108.0 is available in the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=openspec-ui.openspec-ui-vscode). To try the review, open an active change that already has committed work and select **PR Review** from its Pipeline card.
