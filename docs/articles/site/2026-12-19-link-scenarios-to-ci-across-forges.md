---
title: "Link an OpenSpec scenario to a CI check"
summary: "Pick a reported check in PR Review, preview the mapping diff and save the association across GitHub, GitLab and Gitea."
cover: "cover.png"
cover_alt: "An amber line from a highlighted specification row connects to one of three status indicators."
---

A pull request adds two checkout scenarios. One accepts a postal code after trimming spaces. The other rejects an empty address field. CI shows a green checkout job. The useful detail in review is which scenario the team expects that job to exercise.

## Pick a check from the reviewed revision

In **PR Review**, select **Refresh PR checks**. Workbench reads the unique open request for the branch. GitHub supplies check runs and commit statuses. GitLab supplies jobs from the latest merge request pipeline for the published SHA. Gitea supplies commit statuses and the branch's required contexts when available. The report shows the revision and available run links, and marks incomplete results or rules.

When the published SHA matches the local reviewed commit and the check can be identified by its name, choose the scenario and the reported check. In VS Code, start with **Link scenario to check**. In standalone, use the scenario and check fields and select **Show Mapping Preview**.

## Read the diff before you save

For the postal-code scenario, choose the checkout integration job if it really exercises that case. Leave the empty-address scenario available for its own check. Read the proposed diff, select **Save Scenario Mapping**, and commit the resulting `scenario-checks.json` beside the proposal. Push and refresh the review to see the committed association next to the check result.

The association records the team's intent. To confirm what a job actually exercised, open its run or inspect the test. A GitLab pipeline on a synthetic merge commit remains evidence for that commit, while scenario evidence here follows the reviewed head. [Scenario mapping guide](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/how-to/link-scenarios-to-checks.md)
