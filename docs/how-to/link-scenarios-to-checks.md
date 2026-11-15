# Link OpenSpec scenarios to PR checks

PR Review lists the scenarios added or modified in the reviewed commit. To
associate a scenario with CI, place a `scenario-checks.json` beside the
change's `proposal.md` and commit it with the delta. Use the capability
directory name, the exact requirement and scenario headings without their
prefixes, and check names as your forge reports them. You can also select a
scenario and a uniquely named reported check from PR Review. Read the mapping
diff and choose **Save scenario mapping** before committing the file.

```json
{
  "scenarios": [
    {
      "capability": "checkout",
      "requirement": "The order keeps its shipping address",
      "scenario": "A customer edits their address",
      "checks": ["Checkout integration"]
    }
  ]
}
```

Open **PR Review** on the change and select **Refresh PR checks**. After
the published head matches your reviewed commit, the entry shows the named
check's reported state. Leave a scenario unlinked if it has no associated
check. The association records what the team says the check covers.

GitHub supplies check runs and commit statuses. GitLab supplies jobs from
the latest merge request pipeline for the exact published commit. Gitea
supplies commit statuses. GitLab and Gitea use the existing `GITLAB_TOKEN`
and `GITEA_TOKEN` environment settings. A pipeline running on a synthetic
merge commit is evidence for that commit and does not satisfy a scenario
linked to the reviewed head.
