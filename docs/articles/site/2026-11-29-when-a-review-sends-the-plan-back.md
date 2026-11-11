---
title: When a review sends the plan back
summary: A changes-needed verdict lets the Harness revise an existing OpenSpec plan from its review before implementation.
cover: cover.png
cover_alt: The blue OpenSpec Workbench owl holds a pencil over a notebook beside the title When a review sends the plan back.
---

A tester ran Review on an OpenSpec change and got five things to fix. They ran Propose again and saw no change in the files. Propose had already filled in the missing artifacts. The reviewer had asked for revisions to the ones that existed.

That distinction matters before implementation. A review can find a missing requirement or an inconsistency between the design and the task list. The work still belongs in the plan.

## Give the review a verdict the harness can read

The reviewer can finish with `Review verdict: ready` or `Review verdict: changes needed`. Workbench reads that line as a decision. The rest of the review is the material a later Update stage can use.

When a chain receives `changes needed`, it runs one Update using the review stage's agent before it proceeds to Apply. With `ready`, the chain proceeds directly. The update reads the last completed review from the audit log, along with any operator notes or recorded answers. It revises the existing planning artifacts and validates the change. Its write scope is the change's planning directory. If the update fails, the chain stops there.

## Watch one requirement move through the plan

Say the review asks what should happen when a settings file is missing. A useful Update adds the expected behavior to the spec, records the chosen default in the design, and gives the task list a check for that case. The Apply stage can then read a coherent plan with an observable result to verify.

You can also start the update yourself after reviewing the findings. Use **Update Plan** from the change's controls, or give the terminal command a note that resolves the reviewer's question.

```bash
openspec-ui-cli update plan my-change --note "Use the workspace default when the change has no settings file."
```

Read the artifact diff before implementation if you want to check how the note landed.

```bash
openspec-ui-cli show diff my-change
```

[ADR 0041](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0041-the-plan-is-updated-from-its-review.md) records the original review and the rule that gives each review at most one automatic update.
