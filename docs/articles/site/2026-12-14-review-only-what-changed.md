---
title: "Review only what changed since your last pass"
summary: "Remember the commit you reviewed, then compare an agent's follow-up edits with that exact revision."
cover: "cover.png"
cover_alt: "A brass bookmark marks one revision sheet while a cyan strip highlights changed rows on another."
---

The first review of a checkout change raised one question. What happens if a customer submits a postal code with trailing spaces? The agent answers with a revised scenario, a small code change and a test. The pull request still contains the entire checkout change. A second pass starts with a narrower question about what changed in response to the review.

## Save the revision you reviewed

In **PR Review**, open the change and read the committed diff. Select **Mark as reviewed** to record the displayed head locally. The marker is tied to the repository and change, so a linked worktree can use it too. Workbench checks that the displayed commit is still the head when you mark it. Your review marker lives locally.

When the next commit arrives, reopen **PR Review** and select **Show Changes Since Last Review**. The report compares the committed trees at your saved SHA and the current local head. In this example, you can read the revised scenario and its test together, then see whether the follow-up also touched a file you already reviewed.

## Keep the comparison and the checks in view

Select **Show Full PR Diff** when you want to see the change against the PR target again. Use that view for the overall assessment before merge, including changes outside the scope of the last request. Uncommitted edits are reported as excluded from the comparison.

A saved review is a pointer to what you read. Verification results keep their own commit identity. When you refresh CI after a push, check the SHA beside the results before using a passing run as evidence for the revised code. [PR Review implementation](https://github.com/VeryComplexAndLongName/OpenSpec-UI/pull/980)
