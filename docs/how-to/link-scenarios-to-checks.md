# Link OpenSpec scenarios to GitHub checks

PR Review lists the scenarios added or modified in the reviewed commit. To
associate a scenario with CI, place a `scenario-checks.json` beside the
change's `proposal.md` and commit it with the delta. Use the capability
directory name, the exact requirement and scenario headings without their
prefixes, and check names as GitHub reports them.

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

Open **PR Review** on the change and select **Refresh GitHub checks**. After
the published head matches your reviewed commit, the entry shows the named
check's reported state. Leave a scenario unlinked if it has no associated
check. The association records what the team says the check covers.
