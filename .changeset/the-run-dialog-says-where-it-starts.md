---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

The run dialog says where a run begins, and why: "Continues at apply: 1
task still open.", "Starts at propose: there is no proposal and task list
yet.", or "Continues at verify: every task is done." The chain resumes
with the same function, so the dialog cannot name one stage and the run
begin at another. Under the `assisted` autonomy level the dialog no longer
offers "Run the chain", which the runner refused the moment it started;
it says instead that a chain is not offered and that Semi-autonomous
offers one.
